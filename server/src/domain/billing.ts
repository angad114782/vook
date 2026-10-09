import { createHash, randomBytes } from 'node:crypto';
import { coll, withTransaction, type Doc } from '../db/mongo.ts';
import { byId, count, find, findOne, insert, out, type Row } from '../db/repo.ts';
import { env } from '../config/env.ts';
import { newId } from '../lib/ids.ts';
import { logger } from '../lib/logger.ts';
import { sendMail } from '../lib/mail.ts';
import { notify } from '../lib/notify.ts';
import { nextSeq } from '../lib/sequence.ts';
import { nowIso } from '../lib/serialize.ts';
import { appendAudit, invalidateTenant } from './access.ts';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const periodDays = (cycle: string) => (cycle === 'Annual' ? 365 : 30);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export async function nextInvoiceNumber() {
  const year = new Date().getUTCFullYear();
  const seq = await nextSeq(`invoice:${year}`, () => count('invoices', { invoiceNumber: { $regex: `^INV-${year}-` } }));
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
}

export async function issueVerificationEmail(registration: Row) {
  const token = randomBytes(32).toString('base64url');
  await coll('registrations').updateOne({ _id: registration.id }, { $set: { verificationTokenHash: sha(token), verificationExpiresAt: addDays(2) } });
  await sendMail({ to: registration.adminEmail, subject: 'Verify your email to start using Vook', text: `Hi ${registration.adminName}, confirm your email to activate ${registration.companyName}.`, link: `${env.CORS_ORIGIN}/verify-email?token=${token}` });
}

/** Moves a PENDING payment to PAID/FAILED exactly once, then runs what that payment was for. Safe to call repeatedly (webhooks retry). */
export async function settlePayment(paymentId: string, outcome: 'PAID' | 'FAILED', extra: Row = {}) {
  const payment = await coll('payments').findOneAndUpdate({ _id: paymentId, status: 'PENDING' }, { $set: { status: outcome, ...(outcome === 'PAID' ? { paidAt: nowIso() } : {}), ...extra } }, { returnDocument: 'after' });
  if (!payment) return null; // already settled
  const p = out(payment as Doc) as Row;
  if (p.purpose === 'REGISTRATION') {
    const registration = await byId('registrations', p.registrationId);
    if (registration) {
      await coll('registrations').updateOne({ _id: registration.id }, { $set: { status: outcome } });
      if (outcome === 'PAID') await issueVerificationEmail(registration);
    }
  } else if (p.purpose === 'SUBSCRIPTION' && outcome === 'PAID') {
    await applySubscriptionPayment(p);
  }
  return p;
}

async function applySubscriptionPayment(payment: Row) {
  const version = await byId('planVersions', payment.planVersionId);
  const subscription = await findOne('subscriptions', { companyId: payment.companyId });
  if (!version || !subscription) { logger.error({ paymentId: payment.id }, 'paid subscription payment could not be applied'); return; }
  const end = addDays(periodDays(payment.billingCycle));
  await coll('subscriptions').updateOne({ _id: subscription.id }, { $set: { planId: version.planId, planVersionId: version.id, plan: version.type, billingCycle: payment.billingCycle, amount: payment.amount, startDate: nowIso(), endDate: end, currentPeriodEnd: end, trialEndsAt: null, graceEndsAt: null, status: 'ACTIVE', isActive: true, pendingChange: null, cancelAtPeriodEnd: false } });
  await coll('companies').updateOne({ _id: payment.companyId }, { $set: { plan: version.type, status: 'ACTIVE', maxUsers: version.limits.employees, planExpiry: end } });
  const invoice = await insert('invoices', { companyId: payment.companyId, subscriptionId: subscription.id, paymentId: payment.id, invoiceNumber: await nextInvoiceNumber(), status: 'PAID', amount: payment.amount, currency: payment.currency, planName: version.name, billingCycle: payment.billingCycle, issuedAt: nowIso(), paidAt: nowIso() }, 'invoice');
  invalidateTenant(payment.companyId);
  const admins = await find('users', { companyId: payment.companyId, role: 'COMPANY_ADMIN', isActive: true }, { projection: { _id: 1 } });
  await Promise.all(admins.map((a) => notify({ userId: a.id, companyId: payment.companyId, type: 'BILLING', title: 'Plan updated', message: `Your ${version.name} plan is active. Invoice ${invoice.invoiceNumber} is ready.`, data: { invoiceId: invoice.id } })));
  await appendAudit({ companyId: payment.companyId, action: 'SUBSCRIPTION_PAID', entityType: 'SUBSCRIPTION', entityId: subscription.id, newValue: { planVersionId: version.id, billingCycle: payment.billingCycle, amount: payment.amount } });
}

/** Creates the company, its admin, roles, subscription and invoice together, or nothing at all. */
export async function provisionRegistration(registrationId: string) {
  return withTransaction(async (session) => {
    const reg = await coll('registrations').findOne({ _id: registrationId }, { session });
    if (!reg) throw new Error('Registration not found');
    if (reg.companyId) return { companyId: reg.companyId as string, adminEmail: reg.adminEmail as string };
    if (reg.status !== 'PAID') throw new Error('Registration is not paid');
    const version = await coll('planVersions').findOne({ _id: reg.planVersionId }, { session });
    const plan = version ? await coll('plans').findOne({ _id: version.planId }, { session }) : null;
    if (!version || !plan) throw new Error('Published registration plan is missing');
    const now = nowIso();
    const companyId = newId('company');
    const end = addDays(periodDays(reg.billingCycle));
    const amount = reg.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
    const seq = await nextSeq('company-code', () => count('companies'));
    await coll('companies').insertOne({ _id: companyId, companyCode: `WEB-${String(seq).padStart(3, '0')}`, name: reg.companyName, legalName: reg.companyName, displayName: reg.companyName, email: reg.companyEmail ?? reg.adminEmail, industry: null, phone: null, address: null, timezone: 'Asia/Kolkata', currency: 'INR', plan: plan.type, status: 'ACTIVE', maxUsers: version.limits.employees, userCount: 1, planExpiry: end, createdAt: now }, { session });
    const adminId = newId('user');
    await coll('users').insertOne({ _id: adminId, name: reg.adminName, email: reg.adminEmail, emailLower: String(reg.adminEmail).toLowerCase(), passwordHash: reg.adminPasswordHash, role: 'COMPANY_ADMIN', companyId, isActive: true, twoFactorEnabled: false, createdAt: now, lastLoginAt: null }, { session });
    const templates = await coll('roleDefinitions').find({ companyId: 'platform' }, { session }).toArray();
    const cloned: Doc[] = templates.map(({ _id, ...t }) => ({ ...t, _id: `${String(t.key).toLowerCase()}_${companyId}`, companyId, revision: 1 }));
    if (cloned.length) await coll('roleDefinitions').insertMany(cloned, { session });
    const adminRole = cloned.find((r) => r.key === 'COMPANY_ADMIN');
    if (adminRole) await coll('roleAssignments').insertOne({ _id: newId('assignment'), companyId, userId: adminId, roleDefinitionId: adminRole._id, scopeType: 'COMPANY', scopeId: companyId, isPrimary: true, createdAt: now }, { session });
    const subscriptionId = newId('subscription');
    await coll('subscriptions').insertOne({ _id: subscriptionId, companyId, planId: plan._id, planVersionId: version._id, plan: plan.type, billingCycle: reg.billingCycle ?? 'Monthly', amount, startDate: now, endDate: end, trialEndsAt: null, currentPeriodEnd: end, status: 'ACTIVE', isActive: true }, { session });
    await coll('onboardings').insertOne({ _id: companyId, companyId, status: 'NOT_STARTED', steps: ['company-profile', 'first-branch', 'organization', 'roles', 'shifts-holidays', 'attendance-policy', 'leave-policy', 'workflows', 'payroll', 'expenses', 'employees', 'invitations'].map((key) => ({ key, status: 'NOT_STARTED' })) }, { session });
    const year = new Date().getUTCFullYear();
    const invSeq = await nextSeq(`invoice:${year}`, () => count('invoices', { invoiceNumber: { $regex: `^INV-${year}-` } }));
    await coll('invoices').insertOne({ _id: newId('invoice'), companyId, subscriptionId, invoiceNumber: `INV-${year}-${String(invSeq).padStart(5, '0')}`, status: 'PAID', amount, currency: version.currency, planName: version.name, billingCycle: reg.billingCycle, issuedAt: now, paidAt: now }, { session });
    await coll('payments').updateMany({ registrationId: reg._id }, { $set: { companyId } }, { session });
    await coll('registrations').updateOne({ _id: reg._id }, { $set: { companyId, adminUserId: adminId, status: 'PROVISIONED', emailVerified: true, verifiedAt: now }, $unset: { adminPasswordHash: '', verificationTokenHash: '' } }, { session });
    await coll('audit').insertOne({ _id: newId('audit'), actorId: adminId, companyId, action: 'ONLINE_COMPANY_PROVISIONED', entityType: 'COMPANY', entityId: companyId, oldValue: null, newValue: { planVersionId: version._id }, createdAt: now }, { session });
    return { companyId, adminEmail: reg.adminEmail as string };
  });
}

/** Hourly housekeeping: apply scheduled plan changes, then move lapsed subscriptions along ACTIVE → PAST_DUE → SUSPENDED. */
export async function runBillingTick() {
  const now = new Date();
  const iso = now.toISOString();
  const due = await find('subscriptions', { 'pendingChange.effectiveAt': { $lte: iso } }, { limit: 200 });
  for (const sub of due) {
    const version = await byId('planVersions', sub.pendingChange.planVersionId);
    if (!version) { await coll('subscriptions').updateOne({ _id: sub.id }, { $set: { pendingChange: null } }); continue; }
    const amount = sub.pendingChange.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
    await coll('subscriptions').updateOne({ _id: sub.id }, { $set: { planId: version.planId, planVersionId: version.id, plan: version.type, billingCycle: sub.pendingChange.billingCycle, amount, pendingChange: null } });
    await coll('companies').updateOne({ _id: sub.companyId }, { $set: { plan: version.type, maxUsers: version.limits.employees } });
    invalidateTenant(sub.companyId);
  }
  const lapsed = await coll('subscriptions').updateMany({ status: { $in: ['ACTIVE', 'TRIAL'] }, endDate: { $lt: iso } }, { $set: { status: 'PAST_DUE', graceEndsAt: new Date(now.getTime() + 7 * 86_400_000).toISOString() } });
  const suspended = await coll('subscriptions').updateMany({ status: 'PAST_DUE', graceEndsAt: { $lt: iso } }, { $set: { status: 'SUSPENDED', isActive: false } });
  if (lapsed.modifiedCount || suspended.modifiedCount || due.length) { invalidateTenant(); logger.info({ lapsed: lapsed.modifiedCount, suspended: suspended.modifiedCount, planChanges: due.length }, 'billing tick'); }
}
