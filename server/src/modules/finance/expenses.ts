import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, insert, pageQuery, pagination, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, can, effectivePermissions, recordWithinScope } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { idempotent } from '../../lib/idempotency.ts';
import { notify } from '../../lib/notify.ts';
import { nowIso } from '../../lib/serialize.ts';
import { assertOwnFile } from '../files/routes.ts';

export const expenseRouter = Router();

const PENDING = ['PENDING', 'SUBMITTED', 'MANAGER_APPROVED'];
const APPROVED = ['APPROVED', 'FINANCE_APPROVED'];
const statusFilter = (status: string): Row | null => {
  if (!status || status === 'ALL') return null;
  if (status === 'PENDING') return { status: { $in: PENDING } };
  if (status === 'APPROVED') return { status: { $in: APPROVED } };
  if (status === 'COMPLETED') return { status: { $in: ['PAID', 'REJECTED'] } };
  return { status };
};

async function statsFor(base: Row) {
  const [pending, approved, rejected, totals] = await Promise.all([
    count('expenses', { ...base, status: { $in: PENDING } }), count('expenses', { ...base, status: { $in: [...APPROVED, 'PAID'] } }), count('expenses', { ...base, status: 'REJECTED' }),
    coll('expenses').aggregate([{ $match: base }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
  ]);
  return { pending, approved, rejected, total: totals[0]?.total ?? 0 };
}

expenseRouter.get('/expenses/mine', async (req, res) => {
  const user = me(req);
  const employee = await findOne('employees', { userId: user.id, companyId: user.companyId });
  const base: Row = { companyId: user.companyId, employeeId: employee?.id ?? '__none__' };
  const extra = statusFilter(String(req.query.status ?? '').toUpperCase());
  const [rows, stats] = await Promise.all([find('expenses', { ...base, ...(extra ?? {}) }, { sort: { createdAt: -1 }, limit: 200 }), statsFor(base)]);
  ok(res, { expenses: rows, stats });
});

expenseRouter.get('/expenses', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const ids = await allowedEmployeeIds(user, 'EXPENSE_MANAGEMENT.VIEW');
  const base: Row = { companyId, ...(ids ? { employeeId: { $in: ids } } : {}) };
  const filter: Row = { ...base, ...(statusFilter(String(req.query.status ?? '').toUpperCase()) ?? {}) };
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    const matching = (await find('employees', { companyId, $or: [{ 'user.name': rx }, { employeeId: rx }] }, { projection: { _id: 1 }, limit: 2000 })).map((e) => e.id);
    filter.$and = [{ $or: [{ employeeId: { $in: matching } }, { category: rx }] }];
  }
  const q = pageQuery(req.query);
  const [rows, total, stats] = await Promise.all([find('expenses', filter, { sort: { createdAt: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }), count('expenses', filter), statsFor(base)]);
  const employees = rows.length ? await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }, { projection: { employeeId: 1, 'user.name': 1 } }) : [];
  const byEmp = new Map(employees.map((e) => [e.id, e]));
  ok(res, { expenses: rows.map((r) => { const e = byEmp.get(r.employeeId); return { ...r, employee: e ? { id: e.id, employeeId: e.employeeId, user: { name: e.user?.name } } : undefined }; }), pagination: pagination(q, total), stats });
});

expenseRouter.post('/expenses/mine', (req, res) => idempotent(req, res, async () => {
  const user = me(req);
  const body = parse(z.object({ category: z.string().trim().min(1).max(60), amount: z.coerce.number().positive().max(10_000_000), description: z.string().trim().max(500).optional(), receiptUrl: z.string().max(200).nullish() }), req.body);
  const employee = await findOne('employees', { userId: user.id, companyId: user.companyId });
  if (!employee) throw new AppError(404, 'EMPLOYEE_PROFILE_REQUIRED', 'No employee profile is linked to this account.');
  const receipt = await assertOwnFile(body.receiptUrl, user.companyId!, 'receipt');
  if (receipt && receipt.ownerId !== user.id) throw forbidden('You can only attach receipts you uploaded.', 'SCOPE_DENIED');
  const createdAt = nowIso();
  const expense = await insert('expenses', { companyId: user.companyId, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, ...body, amount: Math.round(body.amount * 100) / 100, status: 'SUBMITTED', approvalStage: 'MANAGER_APPROVAL', createdAt }, 'expense');
  await insert('approvals', { companyId: user.companyId, employeeId: employee.id, entityType: 'EXPENSE', entityId: expense.id, type: 'Expense', details: `${body.category} · ₹${body.amount}`, status: 'PENDING', currentStage: 'MANAGER_APPROVAL', history: [], createdAt }, 'approval');
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'EXPENSE_SUBMITTED', entityType: 'EXPENSE', entityId: expense.id, newValue: { category: body.category, amount: body.amount }, ...reqMeta(req) });
  return { status: 201, body: { data: expense } };
}));

expenseRouter.patch('/expenses/:id', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ status: z.string().optional(), action: z.string().optional(), comment: z.string().max(500).nullish() }), req.body);
  const found = await findOne('expenses', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Expense');
  const decision = String(body.status ?? body.action ?? '').toUpperCase();
  if (!decision) throw new AppError(422, 'VALIDATION_ERROR', 'Choose approve, reject or paid.');
  const action = decision.includes('REJECT') ? 'REJECT' : 'APPROVE';
  const paying = decision === 'PAID';
  if (['PAID', 'REJECTED'].includes(found.status)) throw new AppError(409, 'ALREADY_DECIDED', 'This expense has already been closed.');
  const expectedRole = !found.approvalStage || found.approvalStage === 'MANAGER_APPROVAL' ? 'MANAGER' : 'FINANCE';
  if (user.role !== expectedRole && user.role !== 'COMPANY_ADMIN') throw new AppError(409, 'WORKFLOW_STAGE_MISMATCH', `This step needs a ${expectedRole.toLowerCase()} to decide.`, { currentStage: found.approvalStage, expectedRole });
  const required = paying ? 'EXPENSE_MANAGEMENT.PROCESS' : `EXPENSE_MANAGEMENT.${action}`;
  if (!can(await effectivePermissions(user), required)) throw forbidden('Your role does not grant this expense decision.');
  if (paying && found.approvalStage !== 'REIMBURSEMENT') throw new AppError(409, 'NOT_READY_TO_PAY', 'This expense needs approval before it can be paid.');
  if (!(await recordWithinScope(user, found, required))) throw forbidden('This expense is outside your scope.', 'SCOPE_DENIED');
  const owner = await byId('employees', found.employeeId);
  if (owner?.userId === user.id) throw new AppError(403, 'SELF_APPROVAL', 'You cannot decide your own expense.');
  let set: Row;
  if (action === 'REJECT') set = { status: 'REJECTED', approvalStage: 'COMPLETED' };
  else if (paying) set = { status: 'PAID', approvalStage: 'COMPLETED', paidAt: nowIso() };
  else if (user.role === 'MANAGER') set = { status: 'MANAGER_APPROVED', approvalStage: 'FINANCE_APPROVAL' };
  else set = { status: 'FINANCE_APPROVED', approvalStage: 'REIMBURSEMENT' };
  const updated = await coll('expenses').findOneAndUpdate({ _id: found.id, status: found.status, approvalStage: found.approvalStage ?? null }, { $set: set }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'ALREADY_DECIDED', 'This expense was just decided by someone else.');
  await coll('approvals').updateOne({ entityType: 'EXPENSE', entityId: found.id }, { $set: { status: set.approvalStage === 'COMPLETED' ? set.status : 'PENDING', currentStage: set.approvalStage, updatedAt: nowIso() }, $push: { history: { actorId: user.id, role: user.role, action: paying ? 'PAID' : action, comment: body.comment ?? null, at: nowIso() } } as never });
  if (owner?.userId && ['REJECTED', 'PAID', 'FINANCE_APPROVED'].includes(set.status)) {
    await notify({ userId: owner.userId, companyId: found.companyId, type: 'EXPENSE', title: `Expense ${set.status === 'FINANCE_APPROVED' ? 'approved' : set.status.toLowerCase()}`, message: `Your ${found.category} expense of ₹${found.amount} is ${set.status === 'FINANCE_APPROVED' ? 'approved and waiting for payment' : set.status.toLowerCase()}.`, data: { expenseId: found.id } });
  }
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: `EXPENSE_${set.status}`, entityType: 'EXPENSE', entityId: found.id, oldValue: { status: found.status }, newValue: set, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});
