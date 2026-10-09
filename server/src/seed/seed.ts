import { coll } from '../db/mongo.ts';
import { COLLECTIONS, insertMany, type CollectionName, type Row } from '../db/repo.ts';
import { hashPassword } from '../lib/password.ts';
import { logger } from '../lib/logger.ts';
import PDFDocument from 'pdfkit';
import { storage } from '../lib/storage.ts';
import { VOOK_LOGINS, VOOK_MOBILES } from './accounts.ts';
import { BUILTIN_PROVIDERS, providerRows } from '../domain/attendanceDevices.ts';
import { generateBulk } from './bulk.ts';
import { createMockSeed, MOCK_PASSWORD } from './mockSeed.ts';

const samplePdf = (title: string) => new Promise<Buffer>((resolve) => {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks)));
  doc.fontSize(20).text(title).moveDown().fontSize(11).text('Demo document generated for the sample data set.');
  doc.end();
});

const SEEDED_KEYS: CollectionName[] = [
  'companies', 'plans', 'planVersions', 'subscriptions', 'entitlementOverrides', 'roleDefinitions', 'roleAssignments', 'teams', 'reportingLines',
  'employees', 'departments', 'designations', 'offices', 'attendance', 'attendanceEvents', 'attendanceRegularizations', 'attendancePeriods',
  'holidayCalendars', 'payrollCompliance', 'leaves', 'approvals', 'salaries', 'salaryHistory', 'payrollRuns', 'payslips', 'expenses', 'documents',
  'modules', 'notifications', 'tickets', 'comments', 'activity', 'payments', 'invoices', 'registrations', 'audit', 'integrations',
  'attendanceIntegrations', 'workflows',
];

const mobileKey = (value: unknown) => String(value ?? '').replace(/\D/g, '').slice(-10) || undefined;

/** Idempotent: only runs when the database has no users. Demo data only — never enable SEED_DEMO in production. */
export async function seedIfEmpty(extraEmployees?: number, vookLogins = true) {
  if ((await coll('users').countDocuments({}, { limit: 1 })) > 0) return false;
  await seedDemo(extraEmployees ?? (await import('../config/env.ts')).env.SEED_EMPLOYEES, { vookLogins });
  return true;
}

/** `extraEmployees` adds a large, realistic company on top of the 12 hand-written people (0 keeps the data set tiny, as tests do). */
export async function seedDemo(extraEmployees = 0, options: { vookLogins?: boolean } = {}) {
  const now = new Date();
  const state = createMockSeed(now) as unknown as Record<string, any>;
  if (extraEmployees > 0) {
    const bulk = generateBulk(extraEmployees, now, (state.employees as Row[]).length + 1);
    for (const key of ['designations', 'employees', 'teams', 'salaries', 'salaryHistory', 'attendance', 'leaves', 'approvals', 'expenses', 'attendanceRegularizations', 'payslips', 'payrollRuns', 'attendancePeriods'] as const) (state[key] as Row[]).push(...bulk[key]);
    for (const team of state.teams as Row[]) if (bulk.addToTeams[team.id]) team.employeeIds = [...new Set([...team.employeeIds, ...bulk.addToTeams[team.id]!])];
  }

  if (options.vookLogins) {
    // Friendly sign-in emails (admin@vook.com, cadmin@vook.com, hrc@vook.com …) for the people who can log in.
    for (const u of state.users as Row[]) if (VOOK_LOGINS[u.id]) u.email = VOOK_LOGINS[u.id];
    for (const e of state.employees as Row[]) if (e.userId && VOOK_LOGINS[e.userId]) e.user = { ...e.user, email: VOOK_LOGINS[e.userId] };
  }

  // Payslips belong to the run that produced them (the totals shown for a run are summed from its payslips).
  const runOf = new Map<string, string>();
  for (const run of state.payrollRuns as Row[]) for (const pid of run.payslipIds ?? []) runOf.set(pid, run.id);
  for (const slip of state.payslips as Row[]) if (!slip.runId && runOf.has(slip.id)) slip.runId = runOf.get(slip.id);

  const users: Row[] = [];
  for (const u of state.users as Row[]) {
    const mobile = VOOK_MOBILES[u.id];
    users.push({ ...u, emailLower: String(u.email).toLowerCase(), ...(mobile ? { mobile, mobileKey: mobile.replace(/\D/g, '').slice(-10) } : {}), passwordHash: await hashPassword(MOCK_PASSWORD), twoFactorEnabled: false, failedLogins: 0 });
  }
  await insertMany('users', users, 'user');

  for (const key of SEEDED_KEYS) {
    const rows = (state[key] ?? []) as Row[];
    if (!rows.length) continue;
    const prepared = key === 'employees'
      ? rows.map((e) => ({ ...e, mobileKey: mobileKey(e.mobile ?? e.phone) }))
      : key === 'attendanceIntegrations'
        // Sample connections carry no real credentials, so they start as drafts until an API key and token are entered.
        ? rows.map((c) => ({ ...c, biometrics: BUILTIN_PROVIDERS.find((p) => p.key === c.providerKey)?.biometrics ?? [], status: c.connectionMode === 'MOBILE' ? c.status : 'DRAFT', secretConfigured: false, lastTestedAt: c.connectionMode === 'MOBILE' ? c.lastTestedAt : null }))
      : key === 'companies'
        ? rows.map((c) => (c.id === 'company_northstar' ? { ...c, employeePrefix: 'NS' } : c)) // matches the NS-0001 style codes in the sample data
      : key === 'workflows'
        ? rows.map((w) => ({ ...w, id: `workflow_${w.type}_company_northstar`, companyId: 'company_northstar' }))
      : key === 'plans'
        ? rows.map((pl) => ({ ...pl, currentVersionId: pl.currentVersionId?.id ?? pl.currentVersionId ?? null }))
      : key === 'salaries' || key === 'salaryHistory'
        ? rows.map((r) => ({ ...r, companyId: (state.employees as Row[]).find((e) => e.id === r.employeeId)?.companyId ?? 'company_northstar' }))
      : key === 'designations'
        // The mock stored populated objects; we store ids and populate on read.
        ? rows.map((d) => ({ ...d, departmentId: d.departmentId?._id ?? d.departmentId ?? null, branchIds: (d.branchIds ?? []).map((b: Row | string) => (typeof b === 'string' ? b : b.id)) }))
        : rows;
    await insertMany(key, prepared, key.replace(/s$/, ''));
  }

  // Platform-level role templates: new companies are provisioned from these (edited by the Super Admin).
  const templates = (state.roleDefinitions as Row[]).filter((r) => r.companyId === 'company_northstar' && r.kind !== 'CUSTOM')
    .map((r) => ({ ...r, id: `tpl_${String(r.key).toLowerCase()}`, _id: undefined, companyId: 'platform' }));
  await insertMany('roleDefinitions', templates, 'tpl');

  // Give every seeded document a real (sample) file so downloads work in the demo.
  for (const d of (state.documents as Row[])) {
    const id = /^\/files\/([\w-]+)$/.exec(d.fileUrl ?? '')?.[1];
    if (!id) continue;
    const data = await samplePdf(d.name);
    const key = `${d.companyId}/${id}.pdf`;
    await storage.put(key, data);
    await insertMany('files', [{ id, companyId: d.companyId, ownerId: null, kind: 'document', name: `${d.name}.pdf`, mime: 'application/pdf', size: data.length, storageKey: key, createdAt: d.createdAt }], 'file');
  }

  await insertMany('attendanceProviders', providerRows(), 'provider');

  // Per-company singletons (the mock kept these as one global object).
  await insertMany('onboardings', (state.onboardings as Row[]).map((o) => ({ ...o, id: o.companyId })), 'onboarding');
  await insertMany('attendancePolicies', [{ id: 'company_northstar', companyId: 'company_northstar', ...state.attendancePolicy }], 'policy');
  await insertMany('platformSettings', [{ id: 'platform', ...state.settings }], 'settings');

  logger.info({ users: users.length }, 'demo data seeded');
}

export async function resetAndSeed(extraEmployees = 0, vookLogins = true) {
  await Promise.all(COLLECTIONS.map((name) => coll(name).deleteMany({})));
  await seedDemo(extraEmployees, { vookLogins });
}
