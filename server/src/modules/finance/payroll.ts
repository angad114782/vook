import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, insert, insertMany, pageQuery, pagination, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, can, effectivePermissions, recordWithinScope, type AuthUser } from '../../domain/access.ts';
import { computePayslip, monthPrefix, periodLabel } from '../../domain/payroll.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { notify } from '../../lib/notify.ts';
import { nowIso } from '../../lib/serialize.ts';

export const payrollRouter = Router();
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const requirePermission = async (user: AuthUser, permission: string, message?: string) => {
  if (!can(await effectivePermissions(user), permission)) throw forbidden(message ?? 'Your role does not grant this action.', 'PERMISSION_DENIED', { permission });
};

// ── Salary structures (effective-dated) ────────────────────────────────
payrollRouter.get('/salaries', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const empFilter: Row = { companyId };
  const ids = await allowedEmployeeIds(user, 'PAYROLL.VIEW');
  if (ids) empFilter._id = { $in: ids };
  const search = String(req.query.search ?? '').trim();
  if (search) { const rx = { $regex: escapeRegex(search), $options: 'i' }; empFilter.$or = [{ 'user.name': rx }, { employeeId: rx }]; }
  if (typeof req.query.employmentType === 'string' && req.query.employmentType) empFilter.employmentType = req.query.employmentType;
  if (typeof req.query.department === 'string' && req.query.department) empFilter.department = req.query.department;
  const q = pageQuery(req.query);
  const [employees, total] = await Promise.all([find('employees', empFilter, { sort: { employeeId: 1 }, skip: q.skip, limit: q.pageSize }), count('employees', empFilter)]);
  const salaries = employees.length ? await find('salaries', { companyId, employeeId: { $in: employees.map((e) => e.id) } }) : [];
  const byEmp = new Map(salaries.map((s) => [s.employeeId, s]));
  const results = employees.filter((e) => byEmp.has(e.id)).map((e) => {
    const s = byEmp.get(e.id)!;
    return { ...s, employeeId: e.employeeId, employeeRef: e.id, name: e.user?.name, department: e.department, designation: e.designation, employmentType: e.employmentType };
  });
  ok(res, { results, pagination: pagination(q, total) });
});

payrollRouter.post('/salaries', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ employeeId: z.string().min(1), annualCtc: z.coerce.number().min(0).max(1e10), basicAnnual: z.coerce.number().min(0).optional(), allowancesAnnual: z.coerce.number().min(0).optional(), deductionsAnnual: z.coerce.number().min(0).optional(), effectiveFrom: DATE }), req.body);
  // Accept either the internal id or the printed employee code (the salary table shows codes).
  const employee = (await findOne('employees', { _id: body.employeeId, companyId })) ?? (await findOne('employees', { employeeId: body.employeeId, companyId }));
  if (!employee) throw notFound('Employee');
  if (!(await recordWithinScope(user, employee, 'PAYROLL.EDIT')) && user.role !== 'COMPANY_ADMIN') throw forbidden('This employee is outside your scope.', 'SCOPE_DENIED');
  const active = (await find('salaryHistory', { employeeId: employee.id, effectiveTo: null }, { sort: { version: -1 }, limit: 1 }))[0];
  if (active && active.effectiveFrom >= body.effectiveFrom) throw new AppError(409, 'SALARY_EFFECTIVE_DATE_CONFLICT', 'The new salary must start after the current one. Pick a later date.');
  const existing = await findOne('salaries', { employeeId: employee.id });
  const effectiveTo = new Date(Date.parse(`${body.effectiveFrom}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (active) await coll('salaryHistory').updateOne({ _id: active.id }, { $set: { effectiveTo } });
  const fields = { annualCtc: body.annualCtc, basicAnnual: body.basicAnnual, allowancesAnnual: body.allowancesAnnual, deductionsAnnual: body.deductionsAnnual, effectiveFrom: body.effectiveFrom, lastRevised: nowIso() };
  const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  let salary: Row;
  if (existing) { await coll('salaries').updateOne({ _id: existing.id }, { $set: set }); salary = { ...existing, ...set }; }
  else salary = await insert('salaries', { companyId, employeeId: employee.id, ...set }, 'salary');
  await insert('salaryHistory', { ...salary, id: undefined, _id: undefined, companyId, salaryId: salary.id, version: Number(active?.version ?? 0) + 1, effectiveTo: null, createdAt: nowIso() }, 'salary_version');
  await coll('employees').updateOne({ _id: employee.id }, { $set: { annualCtc: body.annualCtc } });
  await appendAudit({ actorId: user.id, companyId, action: 'SALARY_VERSION_CREATED', entityType: 'SALARY', entityId: salary.id, oldValue: existing ? { annualCtc: existing.annualCtc } : null, newValue: { annualCtc: body.annualCtc, effectiveFrom: body.effectiveFrom }, ...reqMeta(req) });
  ok(res, salary);
});

// ── Statutory compliance (PF, ESI, PT, TDS) ────────────────────────────
const rateBlock = z.object({ enabled: z.boolean(), employeeGroup: z.string().max(80).optional(), employeeRate: z.number().min(0).max(100).optional(), employerRate: z.number().min(0).max(100).optional(), wageCeiling: z.number().min(0).optional() }).partial();
const complianceSchema = z.object({
  version: z.number().int().optional(), effectiveFrom: DATE.optional(), stateCode: z.string().max(10).optional(),
  pf: rateBlock, esi: rateBlock,
  professionalTax: z.object({ enabled: z.boolean(), employeeGroup: z.string().max(80), stateCode: z.string().max(10) }).partial(),
  labourWelfareFund: z.object({ enabled: z.boolean(), employeeGroup: z.string().max(80), stateCode: z.string().max(10) }).partial(),
  tds: z.object({ enabled: z.boolean(), employeeGroup: z.string().max(80), defaultRegime: z.enum(['NEW', 'OLD']) }).partial(),
}).partial();

payrollRouter.get('/payroll-compliance', async (req, res) => {
  const companyId = companyIdFor(req);
  const found = await findOne('payrollCompliance', { companyId });
  if (found) return ok(res, found);
  const now = new Date();
  const fy = now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  ok(res, { id: `payroll_compliance_${companyId}`, companyId, version: 0, effectiveFrom: `${fy}-04-01`, stateCode: 'MH',
    pf: { enabled: true, employeeGroup: 'All Employees', employeeRate: 12, employerRate: 12, wageCeiling: 15000 },
    esi: { enabled: true, employeeGroup: 'All Employees', employeeRate: 0.75, employerRate: 3.25, wageCeiling: 21000 },
    professionalTax: { enabled: true, employeeGroup: 'All Employees', stateCode: 'MH' }, labourWelfareFund: { enabled: false, employeeGroup: 'All Employees', stateCode: 'MH' },
    tds: { enabled: true, employeeGroup: 'All Employees', defaultRegime: 'NEW' }, updatedAt: nowIso() });
});

payrollRouter.put('/payroll-compliance', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const { version, ...body } = parse(complianceSchema, req.body);
  const found = await findOne('payrollCompliance', { companyId });
  if (found && version !== Number(found.version)) throw new AppError(409, 'VERSION_CONFLICT', 'Compliance settings changed in another session. Refresh and try again.');
  const merged = { ...(found ?? {}), ...body, companyId, version: Number(found?.version ?? 0) + 1, updatedAt: nowIso() };
  let saved: Row;
  if (found) {
    const { id: _a, _id: _b, ...rest } = merged;
    const r = await coll('payrollCompliance').findOneAndUpdate({ _id: found.id, version: found.version }, { $set: rest }, { returnDocument: 'after' });
    if (!r) throw new AppError(409, 'VERSION_CONFLICT', 'Compliance settings changed in another session. Refresh and try again.');
    saved = { id: r._id, ...r };
  } else saved = await insert('payrollCompliance', merged, 'payroll_compliance');
  await appendAudit({ actorId: user.id, companyId, action: 'PAYROLL_COMPLIANCE_UPDATED', entityType: 'PAYROLL_COMPLIANCE', entityId: saved.id, oldValue: found, newValue: saved, ...reqMeta(req) });
  ok(res, saved);
});

// ── Payslips ───────────────────────────────────────────────────────────
const PUBLISHED = ['PUBLISHED', 'PAID'];
async function payslipView(rows: Row[]) {
  const employees = rows.length ? await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }, { projection: { employeeId: 1, 'user.name': 1, department: 1 } }) : [];
  const byEmp = new Map(employees.map((e) => [e.id, e]));
  return rows.map((r) => { const e = byEmp.get(r.employeeId); return { ...r, employee: e ? { id: e.id, employeeId: e.employeeId, user: { name: e.user?.name } } : undefined }; });
}

payrollRouter.get(['/payslips', '/payslips/mine'], async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const mine = req.path.endsWith('/mine') || user.role === 'EMPLOYEE';
  const filter: Row = { companyId };
  if (mine) {
    const employee = await findOne('employees', { userId: user.id, companyId });
    filter.employeeId = employee?.id ?? '__none__';
    filter.status = { $in: PUBLISHED };
  } else {
    const ids = await allowedEmployeeIds(user, 'PAYSLIPS.VIEW');
    let candidates: string[] | null = ids;
    const search = String(req.query.search ?? '').trim();
    const dept = String(req.query.department ?? '');
    const type = String(req.query.employmentType ?? '');
    if (search || dept || type) {
      const ef: Row = { companyId };
      if (search) { const rx = { $regex: escapeRegex(search), $options: 'i' }; ef.$or = [{ 'user.name': rx }, { employeeId: rx }]; }
      if (dept) ef.department = dept;
      if (type) ef.employmentType = type;
      if (ids) ef._id = { $in: ids };
      candidates = (await find('employees', ef, { projection: { _id: 1 }, limit: 5000 })).map((e) => e.id);
    }
    if (candidates) filter.employeeId = { $in: candidates };
  }
  const month = Number(req.query.month) || 0, year = Number(req.query.year) || 0;
  if (month) filter.month = month;
  if (year) filter.year = year;
  const q = pageQuery(req.query);
  if (req.path.endsWith('/mine')) return ok(res, await find('payslips', filter, { sort: { year: -1, month: -1 }, limit: 60 }));
  const [rows, total] = await Promise.all([find('payslips', filter, { sort: { year: -1, month: -1, _id: 1 }, skip: q.skip, limit: q.pageSize }), count('payslips', filter)]);
  ok(res, { payslips: await payslipView(rows), pagination: pagination(q, total) });
});

payrollRouter.get(['/payslips/:id/download', '/payslips/mine/:id/download'], async (req, res) => {
  const user = me(req);
  const payslip = await findOne('payslips', { _id: String(req.params.id), companyId: user.companyId });
  if (!payslip) throw notFound('Payslip');
  const employee = (await byId('employees', payslip.employeeId)) as Row;
  if (user.role === 'EMPLOYEE' || employee.userId === user.id) {
    if (employee.userId !== user.id) throw forbidden('You can only download your own payslips.', 'SCOPE_DENIED');
  } else if (!(await recordWithinScope(user, payslip, 'PAYSLIPS.VIEW'))) throw forbidden('This payslip is outside your scope.', 'SCOPE_DENIED');
  if (!PUBLISHED.includes(String(payslip.status).toUpperCase())) throw new AppError(409, 'PAYSLIP_NOT_PUBLISHED', 'This payslip has not been published yet.');
  const company = await byId('companies', payslip.companyId);
  const s = payslip.snapshot ?? {};
  const inr = (n: number) => `Rs. ${Number(n ?? 0).toLocaleString('en-IN')}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${String(payslip.payslipId ?? payslip.id).replace(/[^\w.-]/g, '_')}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Payslip ${payslip.period}`, Author: company?.name ?? 'Vook' } });
  doc.pipe(res);
  doc.fontSize(18).text(company?.legalName ?? company?.name ?? 'Company', { align: 'left' });
  doc.fontSize(10).fillColor('#64748b').text(`Payslip for ${payslip.period}`).moveDown();
  doc.fillColor('#0f172a').fontSize(11).text(`Employee: ${employee.user?.name}`).text(`Employee ID: ${employee.employeeId}`).text(`Department: ${employee.department ?? '-'}    Designation: ${employee.designation ?? '-'}`).text(`Payable days: ${s.payableDays ?? '-'} of ${s.monthDays ?? '-'}`).moveDown();
  const row = (label: string, value: string, bold = false) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(label, 48, doc.y, { continued: true, width: 300 }).text(value, { align: 'right' }); };
  doc.font('Helvetica-Bold').fontSize(12).text('Earnings').moveDown(0.3);
  row('Basic salary', inr(s.basicSalary)); row('Allowances', inr(s.allowances)); row('Gross salary', inr(payslip.grossSalary), true);
  doc.moveDown().font('Helvetica-Bold').fontSize(12).text('Deductions').moveDown(0.3);
  row('Provident fund', inr(s.pf)); row('ESI', inr(s.esi)); row('Other deductions', inr(s.configuredDeductions)); row('Total deductions', inr(payslip.totalDeductions), true);
  doc.moveDown().fontSize(14); row('Net pay', inr(payslip.netPay), true);
  doc.moveDown(2).font('Helvetica').fontSize(8).fillColor('#94a3b8').text('This is a system-generated payslip.');
  doc.end();
});

payrollRouter.post('/payslips/:id/pay', async (req, res) => {
  const user = me(req);
  await requirePermission(user, 'PAYROLL.PROCESS');
  const found = await findOne('payslips', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Payslip');
  if (found.status === 'PAID') return ok(res, (await payslipView([found]))[0]);
  if (found.status !== 'PUBLISHED') throw new AppError(409, 'PAYSLIP_NOT_PUBLISHED', 'Only published payslips can be marked as paid.');
  const updated = await coll('payslips').findOneAndUpdate({ _id: found.id, status: 'PUBLISHED' }, { $set: { status: 'PAID', paymentStatus: 'PAID', paidAt: nowIso() } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'ALREADY_DECIDED', 'This payslip was just updated by someone else.');
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'PAYSLIP_PAID', entityType: 'PAYSLIP', entityId: found.id, oldValue: { status: found.status }, newValue: { status: 'PAID' }, ...reqMeta(req) });
  ok(res, (await payslipView([{ id: updated._id, ...updated }]))[0]);
});

async function calcFor(companyId: string, employee: Row, month: number, year: number) {
  const [salary, compliance, attendance] = await Promise.all([
    findOne('salaries', { employeeId: employee.id }), findOne('payrollCompliance', { companyId }),
    find('attendance', { employeeId: employee.id, date: { $gte: `${monthPrefix(year, month)}-01`, $lte: `${monthPrefix(year, month)}-31` } }, { projection: { status: 1, leaveType: 1 } }),
  ]);
  if (!salary || Number(salary.annualCtc ?? employee.annualCtc) <= 0) throw new AppError(422, 'SALARY_MISSING', 'Set up this employee’s salary first.');
  return computePayslip({ employee, salary, compliance, attendance, month, year });
}

payrollRouter.post('/payslips/:id/recalculate', async (req, res) => {
  const user = me(req);
  await requirePermission(user, 'PAYROLL.PROCESS');
  const found = await findOne('payslips', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Payslip');
  if (!['DRAFT', 'CALCULATED'].includes(String(found.status))) throw new AppError(409, 'PAYSLIP_IMMUTABLE', 'Published payslips cannot be recalculated.');
  const employee = (await byId('employees', found.employeeId)) as Row;
  const calc = await calcFor(found.companyId, employee, found.month, found.year);
  const updated = await coll('payslips').findOneAndUpdate({ _id: found.id, status: found.status }, { $set: { grossSalary: calc.grossSalary, totalDeductions: calc.totalDeductions, netPay: calc.netPay, snapshot: calc.snapshot } }, { returnDocument: 'after' });
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'PAYSLIP_RECALCULATED', entityType: 'PAYSLIP', entityId: found.id, oldValue: { netPay: found.netPay }, newValue: { netPay: calc.netPay }, ...reqMeta(req) });
  ok(res, (await payslipView([{ id: updated!._id, ...updated }]))[0]);
});

// ── Payroll runs: Finance prepares → reviews; Admin approves → finalizes → publishes ──
const RUN_FLOW: Record<string, { from: string[]; to: string; permission: string }> = {
  review: { from: ['READY', 'CALCULATED'], to: 'UNDER_REVIEW', permission: 'PAYROLL.PROCESS' },
  approve: { from: ['UNDER_REVIEW'], to: 'APPROVED', permission: 'PAYROLL.APPROVE' },
  finalize: { from: ['APPROVED'], to: 'FINALIZED', permission: 'PAYROLL.FINALIZE' },
  publish: { from: ['FINALIZED'], to: 'PUBLISHED', permission: 'PAYROLL.PUBLISH' },
};

payrollRouter.get('/payroll-runs', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const permissions = await effectivePermissions(user);
  const runs = await find('payrollRuns', { companyId }, { sort: { year: -1, month: -1 } });
  const totals = runs.length ? await coll('payslips').aggregate([{ $match: { companyId, runId: { $in: runs.map((r) => r.id) } } }, { $group: { _id: '$runId', n: { $sum: 1 }, gross: { $sum: '$grossSalary' }, ded: { $sum: '$totalDeductions' }, net: { $sum: '$netPay' } } }]).toArray() : [];
  const byRun = new Map(totals.map((t) => [t._id as string, t]));
  ok(res, runs.map((r) => {
    const t = byRun.get(r.id);
    const permittedActions = Object.entries(RUN_FLOW).filter(([, f]) => f.from.includes(r.status) && can(permissions, f.permission)).map(([name]) => name);
    return { ...r, employeeCount: t?.n ?? r.employeeCount ?? r.payslipIds?.length ?? 0, grossPayMinor: Math.round((t?.gross ?? 0) * 100) || r.grossPayMinor || 0, deductionsMinor: Math.round((t?.ded ?? 0) * 100) || r.deductionsMinor || 0, totalNetMinor: Math.round((t?.net ?? 0) * 100) || r.totalNetMinor || 0, version: Number(r.version ?? 1), updatedAt: r.updatedAt ?? r.createdAt, permittedActions };
  }));
});

payrollRouter.post('/payroll-runs', async (req, res) => {
  const user = me(req);
  await requirePermission(user, 'PAYROLL.PROCESS', 'Your role does not grant payroll processing.');
  const companyId = companyIdFor(req);
  const body = parse(z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2100), employeeIds: z.array(z.string()).max(10_000).optional() }), req.body);
  const period = await findOne('attendancePeriods', { companyId, month: body.month, year: body.year });
  if (period?.status !== 'LOCKED') throw new AppError(422, 'ATTENDANCE_PERIOD_NOT_LOCKED', 'Lock the selected attendance period before preparing payroll.', { month: body.month, year: body.year });
  const prefix = monthPrefix(body.year, body.month);
  const open = await count('attendanceRegularizations', { companyId, date: { $regex: `^${prefix}` }, status: { $nin: ['APPROVED', 'REJECTED'] } });
  if (open) throw new AppError(422, 'ATTENDANCE_EXCEPTIONS_OPEN', 'Resolve or reject all attendance regularizations before preparing payroll.', { count: open });
  if (await findOne('payrollRuns', { companyId, month: body.month, year: body.year, status: { $ne: 'CANCELLED' } })) throw new AppError(409, 'PAYROLL_PERIOD_EXISTS', 'A payroll run already exists for this period.');
  const empFilter: Row = { companyId, status: { $ne: 'EXITED' } };
  if (body.employeeIds?.length) empFilter._id = { $in: body.employeeIds };
  const employees = await find('employees', empFilter, { limit: 20_000 });
  const ids = employees.map((e) => e.id);
  const [salaries, attendance, compliance, existing] = await Promise.all([
    find('salaries', { companyId, employeeId: { $in: ids } }), find('attendance', { companyId, date: { $gte: `${prefix}-01`, $lte: `${prefix}-31` } }, { projection: { employeeId: 1, status: 1, leaveType: 1 } }),
    findOne('payrollCompliance', { companyId }), find('payslips', { companyId, month: body.month, year: body.year }),
  ]);
  const salaryBy = new Map(salaries.map((s) => [s.employeeId, s]));
  const attBy = new Map<string, Row[]>();
  for (const a of attendance) (attBy.get(a.employeeId) ?? attBy.set(a.employeeId, []).get(a.employeeId)!).push(a);
  const issues = employees.flatMap((e) => {
    const s = salaryBy.get(e.id);
    const list: Row[] = [];
    if (!s || Number(s.annualCtc ?? e.annualCtc) <= 0) list.push({ employeeId: e.id, name: e.user?.name, source: 'SALARY', reason: 'No salary is set up for this person.' });
    if (!e.joiningDate) list.push({ employeeId: e.id, name: e.user?.name, source: 'EMPLOYEE', reason: 'Joining date is missing.' });
    return list;
  });
  if (issues.length) throw new AppError(422, 'PAYROLL_PREFLIGHT_FAILED', 'Fix these people before creating the payroll run.', issues);
  const lockedPayslips = existing.filter((p) => PUBLISHED.includes(p.status));
  if (lockedPayslips.length) throw new AppError(409, 'PAYSLIPS_ALREADY_PUBLISHED', 'Some payslips for this period are already published and cannot be changed.');

  const runId = (await insert('payrollRuns', { companyId, month: body.month, year: body.year, status: 'CREATING', version: 1, preparedBy: user.id, approvedBy: null, finalizedAt: null, publishedAt: null, payslipIds: [], currency: 'INR', validationIssues: [], createdAt: nowIso(), updatedAt: nowIso() }, 'payroll_run')).id;
  const existingBy = new Map(existing.map((p) => [p.employeeId, p]));
  const label = periodLabel(body.year, body.month);
  const toInsert: Row[] = [];
  const payslipIds: string[] = [];
  const updates: Row[] = [];
  let gross = 0, ded = 0, net = 0;
  for (const e of employees) {
    const calc = computePayslip({ employee: e, salary: salaryBy.get(e.id)!, compliance, attendance: attBy.get(e.id) ?? [], month: body.month, year: body.year });
    gross += calc.grossSalary; ded += calc.totalDeductions; net += calc.netPay;
    const fields = { runId, status: 'DRAFT', paymentStatus: 'NOT_RECORDED', grossSalary: calc.grossSalary, totalDeductions: calc.totalDeductions, netPay: calc.netPay, snapshot: calc.snapshot };
    const prior = existingBy.get(e.id);
    if (prior) { updates.push({ updateOne: { filter: { _id: prior.id }, update: { $set: fields } } }); payslipIds.push(prior.id); }
    else {
      const row = { companyId, employeeId: e.id, payslipId: `PS-${prefix.replace('-', '')}-${e.employeeId}`, month: body.month, year: body.year, period: label, createdAt: nowIso(), ...fields };
      toInsert.push(row);
    }
  }
  const inserted = [];
  for (let i = 0; i < toInsert.length; i += 500) inserted.push(...(await insertMany('payslips', toInsert.slice(i, i + 500), 'payslip')));
  payslipIds.push(...inserted.map((p) => p.id));
  if (updates.length) await coll('payslips').bulkWrite(updates as never, { ordered: false });
  const run = await coll('payrollRuns').findOneAndUpdate({ _id: runId }, { $set: { status: 'READY', payslipIds, employeeCount: employees.length, grossPayMinor: gross * 100, deductionsMinor: ded * 100, totalNetMinor: net * 100, updatedAt: nowIso() } }, { returnDocument: 'after' });
  await appendAudit({ actorId: user.id, companyId, action: 'PAYROLL_CALCULATED', entityType: 'PAYROLL_RUN', entityId: runId, newValue: { month: body.month, year: body.year, employees: employees.length, netPayMinor: net * 100 }, ...reqMeta(req) });
  ok(res, { message: 'Payroll calculated and ready for review.', period: `${body.month}/${body.year}`, month: body.month, year: body.year, created: employees.length, skipped: 0, runId, status: run!.status }, 201);
});

for (const step of Object.keys(RUN_FLOW)) payrollRouter.post(`/payroll-runs/:id/${step}`, async (req, res) => {
  const user = me(req);
  const flow = RUN_FLOW[step]!;
  const run = await findOne('payrollRuns', { _id: String(req.params.id) });
  if (!run || (run.companyId !== user.companyId && user.role !== 'SUPER_ADMIN')) throw notFound('Payroll run');
  const body = parse(z.object({ version: z.number().int(), reason: z.string().trim().max(500).optional() }), req.body);
  if (body.version !== Number(run.version ?? 1)) throw new AppError(409, 'VERSION_CONFLICT', 'This payroll run changed after you opened it. Refresh and review the latest version.');
  if (!body.reason) throw new AppError(422, 'AUDIT_REASON_REQUIRED', 'Add a reason before changing the payroll status.');
  if (!flow.from.includes(run.status)) throw new AppError(409, 'INVALID_PAYROLL_TRANSITION', `This payroll cannot move from ${String(run.status).replaceAll('_', ' ').toLowerCase()} to ${flow.to.replaceAll('_', ' ').toLowerCase()}.`);
  await requirePermission(user, flow.permission);
  // Maker–checker: the person who prepared the run cannot also approve it.
  if (step === 'approve' && run.preparedBy === user.id) throw new AppError(403, 'SAME_ACTOR', 'Someone else must approve a payroll you prepared.');
  const set: Row = { status: flow.to, updatedAt: nowIso() };
  if (step === 'approve') set.approvedBy = user.id;
  if (step === 'finalize') set.finalizedAt = nowIso();
  if (step === 'publish') set.publishedAt = nowIso();
  const updated = await coll('payrollRuns').findOneAndUpdate({ _id: run.id, version: run.version ?? 1, status: run.status }, { $set: set, $inc: { version: 1 } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'This payroll run changed after you opened it. Refresh and review the latest version.');
  if (step === 'publish') {
    await coll('payslips').updateMany({ _id: { $in: run.payslipIds ?? [] }, status: { $in: ['DRAFT', 'CALCULATED'] } }, { $set: { status: 'PUBLISHED' } });
    const people = await find('employees', { _id: { $in: (await find('payslips', { _id: { $in: run.payslipIds ?? [] } }, { projection: { employeeId: 1 } })).map((p) => p.employeeId) }, userId: { $exists: true, $ne: null } }, { projection: { userId: 1 } });
    await Promise.all(people.map((p) => notify({ userId: p.userId, companyId: run.companyId, type: 'PAYROLL', title: 'Payslip published', message: `Your payslip for ${run.month}/${run.year} is available.`, data: { runId: run.id } })));
  }
  await appendAudit({ actorId: user.id, companyId: run.companyId, action: `PAYROLL_${flow.to}`, entityType: 'PAYROLL_RUN', entityId: run.id, oldValue: { status: run.status }, newValue: { status: flow.to }, reason: body.reason, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});
