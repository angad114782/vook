import { randomBytes } from 'node:crypto';
import { coll, withTransaction, type Doc } from '../db/mongo.ts';
import { count } from '../db/repo.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/password.ts';
import { nextSeq } from '../lib/sequence.ts';
import { nowIso } from '../lib/serialize.ts';
import { AppError } from '../lib/errors.ts';
import { mobileKeyOf } from '../lib/ip.ts';
import { appendAudit } from './access.ts';

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
/** A readable one-time password: easy to read out over a call, still long enough to be safe. */
export const generatePassword = () => `${randomBytes(9).toString('base64url').replace(/[-_]/g, 'x')}-${100 + (randomBytes(2).readUInt16BE() % 900)}`;

export interface NewCompanyInput {
  name: string; adminName: string; adminEmail: string; adminMobile?: string; planVersionId: string;
  billingCycle: 'Monthly' | 'Annual'; trialDays: number; password?: string; industry?: string; actorId: string;
}

/** Super Admin creates a company, its first Company Admin, roles, subscription and checklist together, or nothing at all. */
export async function createCompanyByAdmin(input: NewCompanyInput) {
  const email = input.adminEmail.trim().toLowerCase();
  const mobileKey = input.adminMobile ? mobileKeyOf(input.adminMobile) : undefined;
  if (input.adminMobile && !mobileKey) throw new AppError(422, 'VALIDATION_ERROR', 'Enter a valid 10-digit mobile number.');
  const password = input.password || generatePassword();
  if (await coll('users').findOne({ emailLower: email })) throw new AppError(409, 'EMAIL_TAKEN', 'A user with this email already exists.');
  if (mobileKey && await coll('users').findOne({ mobileKey })) throw new AppError(409, 'MOBILE_TAKEN', 'A user with this mobile number already exists.');
  const passwordHash = await hashPassword(password);
  const result = await withTransaction(async (session) => {
    const version = await coll('planVersions').findOne({ _id: input.planVersionId }, { session });
    const plan = version ? await coll('plans').findOne({ _id: version.planId }, { session }) : null;
    if (!version || !plan) throw new AppError(422, 'PLAN_NOT_FOUND', 'Choose one of the published plans.');
    const templates = await coll('roleDefinitions').find({ companyId: 'platform' }, { session }).toArray();
    if (!templates.length) throw new AppError(409, 'ROLES_MISSING', 'The role templates are missing. Restart the server once so they are created.');
    const now = nowIso();
    const companyId = newId('company');
    const onTrial = input.trialDays > 0;
    const end = onTrial ? addDays(input.trialDays) : addDays(input.billingCycle === 'Annual' ? 365 : 30);
    const amount = input.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
    const seq = await nextSeq('company-code', () => count('companies'));
    await coll('companies').insertOne({ _id: companyId, companyCode: `CMP-${String(seq).padStart(3, '0')}`, name: input.name, legalName: input.name, displayName: input.name, email: email, industry: input.industry || null, phone: null, address: null, timezone: 'Asia/Kolkata', currency: 'INR', plan: plan.type, status: onTrial ? 'TRIAL' : 'ACTIVE', maxUsers: version.limits.employees, userCount: 1, planExpiry: end, createdAt: now }, { session });
    const adminId = newId('user');
    await coll('users').insertOne({ _id: adminId, name: input.adminName, email, emailLower: email, ...(mobileKey ? { mobile: `+91 ${mobileKey}`, mobileKey } : {}), passwordHash, role: 'COMPANY_ADMIN', companyId, isActive: true, twoFactorEnabled: false, failedLogins: 0, createdAt: now, lastLoginAt: null }, { session });
    const cloned: Doc[] = templates.map(({ _id, ...t }) => ({ ...t, _id: `${String(t.key).toLowerCase()}_${companyId}`, companyId, revision: 1 }));
    await coll('roleDefinitions').insertMany(cloned, { session });
    const adminRole = cloned.find((r) => r.key === 'COMPANY_ADMIN');
    if (adminRole) await coll('roleAssignments').insertOne({ _id: newId('assignment'), companyId, userId: adminId, roleDefinitionId: adminRole._id, scopeType: 'COMPANY', scopeId: companyId, isPrimary: true, createdAt: now }, { session });
    await coll('subscriptions').insertOne({ _id: newId('subscription'), companyId, planId: plan._id, planVersionId: version._id, plan: plan.type, billingCycle: input.billingCycle, amount, startDate: now, endDate: end, trialEndsAt: onTrial ? end : null, currentPeriodEnd: end, status: onTrial ? 'TRIAL' : 'ACTIVE', isActive: true, createdBy: input.actorId }, { session });
    await coll('onboardings').insertOne({ _id: companyId, companyId, status: 'NOT_STARTED', steps: ['company-profile', 'first-branch', 'organization', 'roles', 'shifts-holidays', 'attendance-policy', 'leave-policy', 'workflows', 'payroll', 'expenses', 'employees', 'invitations'].map((key) => ({ key, status: 'NOT_STARTED' })) }, { session });
    return { companyId, companyCode: `CMP-${String(seq).padStart(3, '0')}`, adminId };
  });
  await appendAudit({ actorId: input.actorId, companyId: result.companyId, action: 'COMPANY_CREATED_BY_PLATFORM', entityType: 'COMPANY', entityId: result.companyId, newValue: { name: input.name, adminEmail: email, planVersionId: input.planVersionId, trialDays: input.trialDays } });
  return { ...result, adminEmail: email, temporaryPassword: input.password ? undefined : password };
}
