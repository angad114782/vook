import type { Filter, FindOptions, Sort } from 'mongodb';
import { coll, type Doc } from './mongo.ts';
import { newId } from '../lib/ids.ts';

export type Row = Record<string, any>;

export const COLLECTIONS = [
  'users', 'sessions', 'companies', 'plans', 'planVersions', 'subscriptions', 'entitlementOverrides', 'roleDefinitions', 'roleAssignments',
  'teams', 'reportingLines', 'employees', 'departments', 'designations', 'offices', 'attendance', 'attendanceEvents',
  'attendanceRegularizations', 'attendancePeriods', 'holidayCalendars', 'payrollCompliance', 'leaves', 'approvals', 'salaries',
  'salaryHistory', 'payrollRuns', 'payslips', 'expenses', 'documents', 'modules', 'notifications', 'tickets', 'comments', 'activity',
  'payments', 'invoices', 'registrations', 'audit', 'integrations', 'attendanceIntegrations', 'workflows', 'onboardings',
  'attendancePolicies', 'platformSettings', 'files', 'idempotency', 'shifts', 'broadcasts', 'authTokens', 'mailOutbox', 'counters', 'otpCodes', 'authThrottle', 'attendanceProviders', 'attendanceDevices', 'lookups',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/** Stored docs use `_id` = the public id. The API shows both `id` and `_id`, as the frontend expects. */
export const out = (doc: Row | null | undefined): any => {
  if (!doc) return doc ?? null;
  const { _id, ...rest } = doc;
  return { id: _id, _id, ...rest };
};
export const outAll = (docs: Row[]) => docs.map((d) => out(d));

const toDoc = (row: Row, prefix: string): Doc => {
  const { id, _id, ...rest } = row;
  return { _id: id ?? _id ?? newId(prefix), ...rest };
};

export const find = async (name: CollectionName, filter: Filter<Doc> = {}, options: FindOptions & { sort?: Sort; limit?: number; skip?: number } = {}) =>
  outAll(await coll(name).find(filter, options).toArray());

export const findOne = async (name: CollectionName, filter: Filter<Doc>, options?: FindOptions) =>
  out(await coll(name).findOne(filter, options));

export const byId = (name: CollectionName, id: string | null | undefined) => (id ? findOne(name, { _id: id }) : Promise.resolve(null));

export const count = (name: CollectionName, filter: Filter<Doc> = {}) => coll(name).countDocuments(filter);

export async function insert(name: CollectionName, row: Row, prefix = name.replace(/s$/, '')): Promise<Row> {
  const doc = toDoc(row, prefix);
  await coll(name).insertOne(doc);
  return out(doc);
}
export async function insertMany(name: CollectionName, rows: Row[], prefix = name.replace(/s$/, '')) {
  if (!rows.length) return [];
  const docs = rows.map((r) => toDoc(r, prefix));
  await coll(name).insertMany(docs, { ordered: false });
  return docs.map((d) => out(d));
}

/** Atomically applies `$set` and returns the updated row (or null). */
export async function patch(name: CollectionName, filter: Filter<Doc>, set: Row, extra: Row = {}): Promise<Row | null> {
  const res = await coll(name).findOneAndUpdate(filter, { $set: set, ...extra }, { returnDocument: 'after' });
  return out(res);
}

export const remove = async (name: CollectionName, filter: Filter<Doc>) => (await coll(name).deleteMany(filter)).deletedCount;

/** Pagination in the shape the frontend already consumes. */
export interface PageQuery { page: number; pageSize: number; skip: number }
export const pageQuery = (query: Record<string, unknown>): PageQuery => {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? query.limit) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
};
export const pagination = (q: PageQuery, total: number) => ({ total, page: q.page, limit: q.pageSize, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) });

export async function findPage(name: CollectionName, filter: Filter<Doc>, query: Record<string, unknown>, sort: Sort = { createdAt: -1, _id: -1 }) {
  const q = pageQuery(query);
  const [rows, total] = await Promise.all([
    find(name, filter, { sort, skip: q.skip, limit: q.pageSize }),
    count(name, filter),
  ]);
  return { rows, pagination: pagination(q, total) };
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
