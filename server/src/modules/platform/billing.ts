import { createHash } from 'node:crypto';
import net from 'node:net';
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { isProd } from '../../config/env.ts';
import { coll } from '../../db/mongo.ts';
import { byId, count, find, findOne, findPage, insert, insertMany, type Row } from '../../db/repo.ts';
import { appendAudit, effectiveEntitlements, invalidateTenant } from '../../domain/access.ts';
import { assertHuman } from '../../lib/botguard.ts';
import { clientIp, IP_RULE, ipMatches } from '../../lib/ip.ts';
import { assertPublicHost } from '../../lib/ssrf.ts';
import { issueVerificationEmail, provisionRegistration, settlePayment } from '../../domain/billing.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { idempotent } from '../../lib/idempotency.ts';
import { hashPassword, passwordProblem } from '../../lib/password.ts';
import { encryptSecret } from '../../lib/secrets.ts';
import { nowIso, pick } from '../../lib/serialize.ts';
import { getPaymentProvider, integrationSecrets } from '../../payments/provider.ts';
import { invalidateSettings } from '../../middleware/maintenance.ts';

/** Routes that need no sign-in: public plans, registration checkout, email verification, gateway webhooks. */
export const publicBillingRouter = Router();
/** Routes behind sign-in: billing history, upgrades, onboarding checklist, integrations, platform settings. */
export const billingRouter = Router();

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const limiter = (windowMs: number, limit: number, message: string) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''), handler: (_q, _s, next) => next(new AppError(429, 'RATE_LIMITED', message)) });

// ── Public: plans + registration checkout ──────────────────────────────
const publicPlans = async () => {
  const { planViews } = await import('./plans.ts');
  return planViews(await find('plans', { status: 'PUBLISHED' }, { sort: { price: 1 } }));
};
publicBillingRouter.get('/plans', async (req, res, next) => {
  if (req.ctx.user?.role === 'SUPER_ADMIN') return next(); // the platform admin also sees drafts
  ok(res, await publicPlans());
});
publicBillingRouter.get('/onboarding/plans', async (_req, res) => ok(res, await publicPlans()));
publicBillingRouter.post('/onboarding/trial', () => { throw new AppError(410, 'ONLINE_CHECKOUT_REQUIRED', 'Signup requires an online subscription purchase; free trials are unavailable.'); });

publicBillingRouter.post('/onboarding/checkout', limiter(3_600_000, 20, 'Too many sign-up attempts from here. Please try again later.'), async (req, res) => {
  const body = parse(z.object({
    company: z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(200).optional() }),
    admin: z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), password: z.string() }),
    plan: z.string().optional(), planId: z.string().optional(), planVersionId: z.string().optional(), billingCycle: z.enum(['Monthly', 'Annual']).default('Monthly'),
    provider: z.string().optional(), simulateFailure: z.boolean().optional(),
  }), req.body);
  await assertHuman(req.body, clientIp(req));
  const problem = passwordProblem(body.admin.password);
  if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem);
  if (body.provider && body.provider !== 'RAZORPAY') throw new AppError(422, 'UNSUPPORTED_PAYMENT_PROVIDER', 'Online signup currently accepts Razorpay checkout only.');
  if (await findOne('users', { emailLower: body.admin.email.toLowerCase() })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists. Please sign in instead.');
  const plan = await findOne('plans', body.planId ? { _id: body.planId } : { type: String(body.plan ?? '').toUpperCase(), status: 'PUBLISHED' });
  const versionId = body.planVersionId ?? plan?.currentVersionId;
  const version = await byId('planVersions', versionId);
  if (!version || version.planId !== plan?.id && !body.planVersionId) throw new AppError(422, 'PUBLISHED_PLAN_REQUIRED', 'Please choose one of the available plans.');
  const amount = body.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
  const provider = await getPaymentProvider();
  const registration = await insert('registrations', {
    acquisition: 'ONLINE_PURCHASE', companyName: body.company.name, companyEmail: body.company.email ?? body.admin.email, adminName: body.admin.name, adminEmail: body.admin.email,
    adminPasswordHash: await hashPassword(body.admin.password), planId: version.planId, planVersionId: version.id, billingCycle: body.billingCycle, provider: provider.name, status: 'PENDING', emailVerified: false, createdAt: nowIso(),
  }, 'registration');
  const order = await provider.createOrder({ amountMinor: Math.round(amount * 100), currency: version.currency, receipt: registration.id, notes: { registrationId: registration.id } });
  await coll('registrations').updateOne({ _id: registration.id }, { $set: { registrationId: registration.id, orderId: order.orderId } });
  const payment = await insert('payments', { companyId: null, registrationId: registration.id, purpose: 'REGISTRATION', plan: version.type, billingCycle: body.billingCycle, planVersionId: version.id, amount, currency: version.currency, source: provider.name, status: 'PENDING', reference: order.orderId, razorpayOrderId: order.orderId, createdAt: nowIso() }, 'payment');
  if (provider.autoSettle) await settlePayment(payment.id, body.simulateFailure && !isProd ? 'FAILED' : 'PAID');
  const final = await byId('registrations', registration.id);
  ok(res, { registrationId: registration.id, orderId: order.orderId, amount, currency: version.currency, keyId: order.keyId, provider: provider.name, status: final?.status }, 201);
});

publicBillingRouter.get('/onboarding/checkout/:id', async (req, res) => {
  const reg = await byId('registrations', String(req.params.id));
  if (!reg) throw notFound('Registration');
  ok(res, { status: reg.status === 'PROVISIONED' ? 'PAID' : reg.status, provider: reg.provider });
});

publicBillingRouter.post('/onboarding/checkout/:id/resend-verification', limiter(900_000, 5, 'Please wait a few minutes before asking for another email.'), async (req, res) => {
  const reg = await byId('registrations', String(req.params.id));
  // Same answer whether or not it exists/applies, so this cannot be used to probe registrations.
  if (reg && reg.status === 'PAID') await issueVerificationEmail(reg);
  ok(res, { message: 'If this registration is waiting for verification, we have sent a new email.' });
});

publicBillingRouter.post('/onboarding/verify-email', limiter(900_000, 30, 'Too many attempts. Please wait a few minutes.'), async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  const reg = await findOne('registrations', { verificationTokenHash: sha(token) });
  if (!reg || (reg.verificationExpiresAt && new Date(reg.verificationExpiresAt) < new Date())) throw new AppError(404, 'INVALID_VERIFICATION', 'This verification link is invalid or has expired. Please ask for a new one.');
  if (reg.status !== 'PAID') throw new AppError(409, 'PAYMENT_REQUIRED', 'Payment must be confirmed before your email can be verified.');
  const { companyId, adminEmail } = await provisionRegistration(reg.id);
  invalidateTenant(companyId);
  ok(res, { verified: true, companyId, adminEmail });
});

// ── Public: payment gateway webhook (signature-verified, idempotent) ──
publicBillingRouter.post('/webhooks/razorpay', async (req, res) => {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  const provider = await getPaymentProvider().catch(() => null);
  if (!raw || !provider || !provider.verifyWebhook(raw, req.headers['x-razorpay-signature'] as string | undefined)) throw new AppError(400, 'BAD_SIGNATURE', 'Webhook signature could not be verified.');
  const event = req.body as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string } } } };
  const orderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
  const payment = orderId ? await findOne('payments', { razorpayOrderId: orderId }) : null;
  if (payment) {
    if (['payment.captured', 'order.paid'].includes(event.event ?? '')) await settlePayment(payment.id, 'PAID', { razorpayPaymentId: event.payload?.payment?.entity?.id });
    else if (event.event === 'payment.failed') await settlePayment(payment.id, 'FAILED');
  }
  res.json({ received: true }); // 2xx tells the gateway not to retry; unknown orders are ignored on purpose
});

// ── Signed-in: onboarding checklist ────────────────────────────────────
const STEP_KEYS = ['company-profile', 'first-branch', 'organization', 'roles', 'shifts-holidays', 'attendance-policy', 'leave-policy', 'workflows', 'payroll', 'expenses', 'employees', 'invitations'];
billingRouter.get('/onboarding', async (req, res) => {
  const companyId = companyIdFor(req);
  const [onboarding, company, firstBranch, entitlements] = await Promise.all([findOne('onboardings', { companyId }), byId('companies', companyId), findOne('offices', { companyId }), effectiveEntitlements(companyId)]);
  ok(res, { onboarding: onboarding ?? { companyId, status: 'NOT_STARTED', steps: STEP_KEYS.map((key) => ({ key, status: 'NOT_STARTED' })) }, company, firstBranch, entitlements });
});

billingRouter.patch('/onboarding/:stepKey', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const stepKey = String(req.params.stepKey);
  if (!STEP_KEYS.includes(stepKey)) throw notFound('Setup step');
  const body = parse(z.object({ status: z.enum(['COMPLETED', 'SKIPPED', 'IN_PROGRESS', 'NOT_STARTED']).optional(), data: z.record(z.string(), z.any()).optional() }), req.body);
  if (body.data && stepKey === 'company-profile') {
    const clean = pick(body.data, ['name', 'legalName', 'displayName', 'email', 'phone', 'address', 'industry', 'timezone', 'currency']);
    if (Object.keys(clean).length) await coll('companies').updateOne({ _id: companyId }, { $set: clean });
  }
  if (body.data && stepKey === 'first-branch' && !(await findOne('offices', { companyId }))) {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120), code: z.string().trim().min(1).max(20), city: z.string().max(80).optional(), latitude: z.number().optional(), longitude: z.number().optional(), geofenceRadiusMeters: z.number().optional() }), body.data);
    await insert('offices', { companyId, isActive: true, geofenceRadiusMeters: 250, ...b }, 'branch');
  }
  let doc = await findOne('onboardings', { companyId });
  if (!doc) doc = await insert('onboardings', { id: companyId, companyId, status: 'NOT_STARTED', steps: STEP_KEYS.map((key) => ({ key, status: 'NOT_STARTED' })) }, 'onboarding');
  const steps = (doc.steps as Row[]).map((s) => (s.key === stepKey ? { ...s, ...(body.status ? { status: body.status } : {}), ...(body.status === 'COMPLETED' ? { completedAt: nowIso() } : {}) } : s));
  const done = steps.filter((s) => ['COMPLETED', 'SKIPPED'].includes(s.status)).length;
  const status = done === steps.length ? 'COMPLETED' : done ? 'IN_PROGRESS' : 'NOT_STARTED';
  await coll('onboardings').updateOne({ _id: doc.id }, { $set: { steps, status } });
  await appendAudit({ actorId: user.id, companyId, action: 'ONBOARDING_STEP_UPDATED', entityType: 'ONBOARDING', entityId: stepKey, newValue: { status: body.status }, ...reqMeta(req) });
  ok(res, { ...doc, steps, status });
});

// ── Signed-in: upgrade / renew via checkout ────────────────────────────
billingRouter.post('/subscription/checkout', (req, res) => idempotent(req, res, async () => {
  const user = me(req);
  if (!['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw forbidden('Only the company admin can change the plan.', 'FORBIDDEN');
  const companyId = companyIdFor(req);
  const body = parse(z.object({ planVersionId: z.string().min(1), billingCycle: z.enum(['Monthly', 'Annual']), provider: z.string().optional() }), req.body);
  if (body.provider && body.provider !== 'RAZORPAY') throw new AppError(422, 'UNSUPPORTED_PAYMENT_PROVIDER', 'Online checkout currently accepts Razorpay only.');
  const version = await byId('planVersions', body.planVersionId);
  const plan = version ? await byId('plans', version.planId) : null;
  if (!version || !plan || plan.status !== 'PUBLISHED' || plan.currentVersionId !== version.id) throw new AppError(422, 'PUBLISHED_PLAN_REQUIRED', 'Please choose one of the currently available plans.');
  const subscription = await findOne('subscriptions', { companyId });
  if (!subscription) throw notFound('Subscription');
  const amount = body.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
  const currentMonthly = subscription.billingCycle === 'Annual' ? Number(subscription.amount) / 12 : Number(subscription.amount);
  const newMonthly = body.billingCycle === 'Annual' ? amount / 12 : amount;
  const isDowngrade = subscription.status === 'ACTIVE' && newMonthly < currentMonthly && subscription.planVersionId !== version.id;
  if (isDowngrade) {
    const people = await count('employees', { companyId, status: { $ne: 'EXITED' } });
    if (people > version.limits.employees) throw new AppError(409, 'DOWNGRADE_BLOCKED', `This plan allows ${version.limits.employees} employees but you have ${people}. Remove or exit some people first.`, { limit: version.limits.employees, current: people });
    const effectiveAt = subscription.currentPeriodEnd ?? subscription.endDate;
    await coll('subscriptions').updateOne({ _id: subscription.id }, { $set: { pendingChange: { planVersionId: version.id, billingCycle: body.billingCycle, effectiveAt } } });
    await appendAudit({ actorId: user.id, companyId, action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED', entityType: 'SUBSCRIPTION', entityId: subscription.id, newValue: { planVersionId: version.id, effectiveAt }, ...reqMeta(req) });
    return { status: 200, body: { data: { scheduled: true, effectiveAt, message: `Your plan will change to ${version.name} when the current period ends.` } } };
  }
  const provider = await getPaymentProvider();
  const order = await provider.createOrder({ amountMinor: Math.round(amount * 100), currency: version.currency, receipt: `sub_${companyId}`.slice(0, 40), notes: { companyId } });
  const payment = await insert('payments', { companyId, subscriptionId: subscription.id, purpose: 'SUBSCRIPTION', plan: version.type, planVersionId: version.id, billingCycle: body.billingCycle, amount, currency: version.currency, source: provider.name, status: 'PENDING', reference: order.orderId, razorpayOrderId: order.orderId, createdAt: nowIso() }, 'payment');
  if (provider.autoSettle) await settlePayment(payment.id, 'PAID');
  return { status: 201, body: { data: { paymentId: payment.id, orderId: order.orderId, amount, currency: version.currency, keyId: order.keyId, provider: provider.name } } };
}));

// ── Payments + invoices ────────────────────────────────────────────────
const paymentFilter = (req: import('express').Request): Row => {
  const user = me(req);
  const filter: Row = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId };
  for (const key of ['source', 'status'] as const) { const v = String(req.query[key] ?? ''); if (v && v !== 'ALL') filter[key] = v; }
  return filter;
};
billingRouter.get('/payments', async (req, res) => {
  const { rows, pagination } = await findPage('payments', paymentFilter(req), req.query);
  const companies = rows.length ? new Map((await find('companies', { _id: { $in: [...new Set(rows.map((r) => r.companyId).filter(Boolean))] } }, { projection: { name: 1, companyCode: 1 } })).map((c) => [c.id, c])) : new Map();
  ok(res, { payments: rows.map((p) => ({ ...p, company: companies.get(p.companyId) })), pagination });
});
billingRouter.get('/payments/mine', async (req, res) => ok(res, await find('payments', { companyId: companyIdFor(req) }, { sort: { createdAt: -1 }, limit: 200 })));
billingRouter.post('/payments/offline', () => { throw new AppError(405, 'ONLINE_PAYMENT_REQUIRED', 'Payments must be collected through online checkout.'); });
billingRouter.patch('/payments/:id', () => { throw new AppError(405, 'PAYMENT_HISTORY_READ_ONLY', 'Payment records cannot be edited.'); });

billingRouter.get('/invoices', async (req, res) => {
  const user = me(req);
  ok(res, await find('invoices', user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }, { sort: { issuedAt: -1 }, limit: 500 }));
});
billingRouter.get('/invoices/:id/download', async (req, res) => {
  const user = me(req);
  const invoice = await byId('invoices', String(req.params.id));
  if (!invoice) throw notFound('Invoice');
  if (user.role !== 'SUPER_ADMIN' && invoice.companyId !== user.companyId) throw forbidden('This invoice belongs to another company.', 'SCOPE_DENIED');
  const company = await byId('companies', invoice.companyId);
  const number = invoice.invoiceNumber ?? invoice.number ?? invoice.id;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${String(number).replace(/[^\w.-]/g, '_')}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(res);
  doc.fontSize(22).text('INVOICE').fontSize(10).fillColor('#64748b').text(`Vook`).moveDown();
  doc.fillColor('#0f172a').fontSize(11).text(`Invoice no: ${number}`).text(`Issued: ${String(invoice.issuedAt ?? '').slice(0, 10)}`).text(`Status: ${invoice.status}`).moveDown();
  doc.text(`Billed to: ${company?.legalName ?? company?.name ?? '-'}`).text(`Plan: ${invoice.planName ?? '-'} (${invoice.billingCycle ?? '-'})`).moveDown();
  doc.fontSize(14).text(`Total: ${invoice.currency ?? 'INR'} ${Number(invoice.amount ?? (invoice.amountMinor ?? 0) / 100).toLocaleString('en-IN')}`);
  doc.end();
});

// ── Platform admin: integrations ───────────────────────────────────────
const DEFINITIONS: Record<string, Row> = {
  RAZORPAY: { displayName: 'Razorpay', category: 'PAYMENTS', available: true, publicFields: [{ key: 'keyId', label: 'Key ID', required: true }, { key: 'environment', label: 'Environment', required: true }], secretFields: [{ key: 'keySecret', label: 'Key secret', required: true }, { key: 'webhookSecret', label: 'Webhook secret', required: true }] },
  PAYU: { displayName: 'PayU', category: 'PAYMENTS', available: true, publicFields: [{ key: 'merchantKey', label: 'Merchant key', required: true }, { key: 'environment', label: 'Environment', required: true }], secretFields: [{ key: 'merchantSalt', label: 'Merchant salt', required: true }] },
  SMTP: { displayName: 'Email delivery', category: 'MESSAGING', available: true, publicFields: [{ key: 'host', label: 'SMTP host', required: true }, { key: 'port', label: 'Port', required: true }, { key: 'fromAddress', label: 'From address', required: true }], secretFields: [{ key: 'username', label: 'Username', required: true }, { key: 'password', label: 'Password', required: true }] },
  WHATSAPP: { displayName: 'WhatsApp Cloud API', category: 'WHATSAPP', available: true, publicFields: [{ key: 'phoneNumberId', label: 'Phone Number ID', required: true }, { key: 'businessAccountId', label: 'WhatsApp Business Account ID', required: false }, { key: 'otpTemplate', label: 'Sign-in code template name (default vook_login_otp)', required: false }], secretFields: [{ key: 'accessToken', label: 'Permanent access token', required: true }] },
  TWILIO: { displayName: 'SMS (Twilio)', category: 'SMS', available: true, publicFields: [{ key: 'accountSid', label: 'Account SID', required: true }, { key: 'fromNumber', label: 'Sender phone number', required: true }], secretFields: [{ key: 'authToken', label: 'Auth token', required: true }] },
};
const integrationView = (row: Row): Row => {
  const providerKey = String(row.providerKey ?? row.key ?? 'CUSTOM').toUpperCase();
  const def = DEFINITIONS[providerKey] ?? { displayName: row.name ?? providerKey, category: row.category ?? 'OTHER', available: false, publicFields: [], secretFields: [] };
  const { secrets, ...rest } = row; // encrypted values never leave the server
  return { ...def, ...rest, providerKey, displayName: row.displayName ?? def.displayName, publicFields: def.publicFields, secretFields: def.secretFields, publicConfig: row.publicConfig ?? {}, secretConfigured: Object.keys(secrets ?? {}).length > 0 || Boolean(row.secretConfigured), pendingConfiguration: Boolean(row.pendingConfiguration) };
};

billingRouter.get('/integrations', async (_req, res) => {
  const rows = await find('integrations', {});
  const present = new Set(rows.map((r) => String(r.providerKey ?? r.key).toUpperCase()));
  const missing = Object.keys(DEFINITIONS).filter((k) => !present.has(k)).map((providerKey) => ({ id: `integration_${providerKey.toLowerCase()}`, providerKey, status: 'NOT_CONFIGURED', publicConfig: {}, secretConfigured: false, pendingConfiguration: false }));
  ok(res, [...rows, ...missing].map(integrationView));
});

async function probe(providerKey: string, publicConfig: Row, secrets: Record<string, string>): Promise<string | null> {
  try {
    if (providerKey === 'RAZORPAY') {
      const r = await fetch('https://api.razorpay.com/v1/orders?count=1', { signal: AbortSignal.timeout(8000), headers: { Authorization: `Basic ${Buffer.from(`${publicConfig.keyId}:${secrets.keySecret}`).toString('base64')}` } });
      return r.ok ? null : r.status === 401 ? 'CREDENTIALS_REJECTED' : `PROVIDER_${r.status}`;
    }
    if (providerKey === 'SMTP') {
      await assertPublicHost(String(publicConfig.host));
      await new Promise<void>((resolve, reject) => { const s = net.connect({ host: String(publicConfig.host), port: Number(publicConfig.port), timeout: 6000 }, () => { s.end(); resolve(); }); s.on('error', reject); s.on('timeout', () => { s.destroy(); reject(new Error('timeout')); }); });
      return null;
    }
    if (providerKey === 'WHATSAPP') {
      const r = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(String(publicConfig.phoneNumberId))}`, { signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${secrets.accessToken}` } });
      return r.ok ? null : r.status === 401 || r.status === 403 ? 'CREDENTIALS_REJECTED' : `PROVIDER_${r.status}`;
    }
    if (providerKey === 'TWILIO') {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(String(publicConfig.accountSid))}.json`, { signal: AbortSignal.timeout(8000), headers: { Authorization: `Basic ${Buffer.from(`${publicConfig.accountSid}:${secrets.authToken}`).toString('base64')}` } });
      return r.ok ? null : r.status === 401 ? 'CREDENTIALS_REJECTED' : `PROVIDER_${r.status}`;
    }
    return null; // providers without a live probe only get the completeness check
  } catch (err) { return err instanceof AppError ? err.code : 'UNREACHABLE'; }
}

const saveIntegration = async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const providerKey = String(req.params.providerKey).toUpperCase();
  const def = DEFINITIONS[providerKey];
  if (!def) throw notFound('Integration');
  const body = parse(z.object({ publicConfig: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).default({}), secrets: z.record(z.string(), z.string().max(2000)).default({}), reason: z.string().max(300).optional() }), req.body);
  const publicKeys = new Set((def.publicFields as Row[]).map((f) => f.key)), secretKeys = new Set((def.secretFields as Row[]).map((f) => f.key));
  if (Object.keys(body.publicConfig).some((k) => !publicKeys.has(k)) || Object.keys(body.secrets).some((k) => !secretKeys.has(k))) throw new AppError(422, 'VALIDATION_ERROR', 'Some fields do not belong to this provider.');
  const existing = await findOne('integrations', { providerKey });
  const secrets = { ...(existing?.secrets ?? {}), ...Object.fromEntries(Object.entries(body.secrets).filter(([, v]) => v.trim()).map(([k, v]) => [k, encryptSecret(v.trim())])) };
  const row = { providerKey, publicConfig: { ...(existing?.publicConfig ?? {}), ...body.publicConfig }, secrets, secretConfigured: Object.keys(secrets).length > 0, pendingConfiguration: true, revision: Number(existing?.revision ?? 0) + 1, status: existing?.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT', updatedAt: nowIso() };
  const saved = existing ? await coll('integrations').findOneAndUpdate({ _id: existing.id }, { $set: row }, { returnDocument: 'after' }).then((r) => ({ id: r!._id, ...r })) : await insert('integrations', { ...row, createdAt: nowIso() }, 'integration');
  await appendAudit({ actorId: user.id, action: 'INTEGRATION_SAVED', entityType: 'INTEGRATION', entityId: providerKey, newValue: { fields: Object.keys({ ...body.publicConfig, ...body.secrets }) }, description: body.reason, ...reqMeta(req) });
  ok(res, integrationView(saved as Row));
};
billingRouter.put('/integrations/:providerKey', saveIntegration);

for (const action of ['test', 'activate', 'disable'] as const) {
  billingRouter.post(`/integrations/:providerKey/${action}`, async (req, res) => {
    const user = me(req);
    const providerKey = String(req.params.providerKey).toUpperCase();
    const def = DEFINITIONS[providerKey];
    const row = await findOne('integrations', { providerKey });
    if (!def || !row) throw notFound('Integration');
    const body = parse(z.object({ reason: z.string().trim().max(300).optional() }), req.body);
    let set: Row = {};
    if (action === 'test') {
      const missing = [...(def.publicFields as Row[]).filter((f) => f.required && !row.publicConfig?.[f.key]), ...(def.secretFields as Row[]).filter((f) => f.required && !row.secrets?.[f.key])];
      if (missing.length) throw new AppError(422, 'INTEGRATION_INCOMPLETE', `Fill in: ${missing.map((f) => f.label).join(', ')}.`);
      const failure = await probe(providerKey, row.publicConfig ?? {}, integrationSecrets(row));
      set = { lastTestedAt: nowIso(), lastErrorCode: failure, testedRevision: failure ? null : row.revision ?? 0 };
      if (failure) await coll('integrations').updateOne({ _id: row.id }, { $set: set });
      if (failure) throw new AppError(422, 'INTEGRATION_TEST_FAILED', failure === 'CREDENTIALS_REJECTED' ? 'The provider rejected these credentials. Please check them.' : 'We could not reach the provider with these details.', { code: failure });
    } else if (action === 'activate') {
      if (!row.lastTestedAt || row.testedRevision !== (row.revision ?? 0)) throw new AppError(409, 'INTEGRATION_NOT_TESTED', 'Test the latest settings before turning this on.');
      set = { status: 'ACTIVE', pendingConfiguration: false };
    } else set = { status: 'NOT_CONFIGURED' };
    const updated = (await coll('integrations').findOneAndUpdate({ _id: row.id }, { $set: set }, { returnDocument: 'after' }))!;
    await appendAudit({ actorId: user.id, action: `INTEGRATION_${action.toUpperCase()}`, entityType: 'INTEGRATION', entityId: providerKey, oldValue: { status: row.status }, newValue: { status: updated.status }, description: body.reason, ...reqMeta(req) });
    ok(res, integrationView({ id: updated._id, ...updated }));
  });
}

// ── Platform admin: settings + announcements ───────────────────────────
const settingsSchema = z.object({
  general: z.object({ platformName: z.string().trim().min(1).max(80), platformUrl: z.string().url().max(200), supportEmail: z.string().email().max(200) }).partial(),
  security: z.object({ twoFA: z.boolean(), sessionTimeout: z.union([z.boolean(), z.number().int().min(5).max(1440)]), blockedIps: z.array(z.string().regex(IP_RULE, 'Use an address like 203.0.113.7 or a range like 203.0.113.0/24.')).max(500), adminAllowedIps: z.array(z.string().regex(IP_RULE, 'Use an address like 203.0.113.7 or a range like 203.0.113.0/24.')).max(100) }).partial(),
  notifications: z.object({ email: z.boolean(), inApp: z.boolean() }).partial(),
  system: z.object({ maxUsers: z.number().int().min(1).max(10_000_000), maintenance: z.boolean(), maintenanceMsg: z.string().max(300) }).partial(),
}).partial();
billingRouter.get('/settings/platform', async (_req, res) => { const { id, _id, ...s } = (await byId('platformSettings', 'platform')) ?? {}; ok(res, s); });
billingRouter.put('/settings/platform', async (req, res) => {
  const user = me(req);
  const body = parse(settingsSchema, req.body);
  const before = (await byId('platformSettings', 'platform')) ?? {};
  const myIp = clientIp(req);
  const security = body.security;
  // Guard rails so the admin cannot lock themselves out of their own platform.
  if (security?.adminAllowedIps?.length && !ipMatches(myIp, security.adminAllowedIps)) throw new AppError(422, 'WOULD_LOCK_OUT', `Your current address (${myIp}) must be on the admin list, otherwise you would lock yourself out.`);
  if (security?.blockedIps?.length && ipMatches(myIp, security.blockedIps)) throw new AppError(422, 'WOULD_LOCK_OUT', `Your current address (${myIp}) is in the blocked list. Remove it first.`);
  const set: Row = {};
  for (const [section, value] of Object.entries(body)) set[section] = { ...(before[section] ?? {}), ...value };
  await coll('platformSettings').updateOne({ _id: 'platform' }, { $set: { ...set, updatedAt: nowIso() } }, { upsert: true });
  invalidateSettings();
  await appendAudit({ actorId: user.id, action: 'PLATFORM_SETTINGS_UPDATED', entityType: 'SETTINGS', entityId: 'platform', oldValue: pick(before, Object.keys(set)), newValue: set, ...reqMeta(req) });
  ok(res, body);
});

billingRouter.get('/broadcasts', async (_req, res) => ok(res, await find('broadcasts', {}, { sort: { createdAt: -1 }, limit: 100 })));
billingRouter.post('/broadcasts', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ title: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(1000), targetRole: z.string().default('ALL'), severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).default('INFO'), reason: z.string().max(300).optional() }), req.body);
  const filter: Row = { isActive: { $ne: false } };
  if (body.targetRole !== 'ALL') filter.role = body.targetRole;
  const recipients = await find('users', filter, { projection: { companyId: 1 }, limit: 100_000 });
  const createdAt = nowIso();
  const broadcast = await insert('broadcasts', { title: body.title, message: body.message, targetRole: body.targetRole, severity: body.severity, recipients: recipients.length, status: 'SENT', sentBy: user.id, createdAt }, 'broadcast');
  for (let i = 0; i < recipients.length; i += 1000) {
    await insertMany('notifications', recipients.slice(i, i + 1000).map((r) => ({ userId: r.id, companyId: r.companyId ?? null, type: 'ANNOUNCEMENT', severity: body.severity, title: body.title, message: body.message, isRead: false, data: { broadcastId: broadcast.id }, createdAt })), 'notification');
  }
  await appendAudit({ actorId: user.id, action: 'BROADCAST_SENT', entityType: 'BROADCAST', entityId: broadcast.id, newValue: { title: body.title, recipients: recipients.length }, description: body.reason, ...reqMeta(req) });
  ok(res, broadcast, 201);
});

