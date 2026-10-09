import { extname } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.ts';
import { byId, count, escapeRegex, find, findOne, insert, pageQuery, pagination, remove, type Row } from '../../db/repo.ts';
import { appendAudit, can, effectivePermissions } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { storage } from '../../lib/storage.ts';
import { nowIso } from '../../lib/serialize.ts';
import { newId } from '../../lib/ids.ts';

export const filesRouter = Router();

const TYPES: Record<string, { mime: string; magic?: (b: Buffer) => boolean }> = {
  '.pdf': { mime: 'application/pdf', magic: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  '.png': { mime: 'image/png', magic: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  '.jpg': { mime: 'image/jpeg', magic: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  '.jpeg': { mime: 'image/jpeg', magic: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  '.webp': { mime: 'image/webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: (b) => b.subarray(0, 2).toString() === 'PK' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: (b) => b.subarray(0, 2).toString() === 'PK' },
  '.csv': { mime: 'text/csv', magic: (b) => !b.subarray(0, 4096).includes(0) },
  '.txt': { mime: 'text/plain', magic: (b) => !b.subarray(0, 4096).includes(0) },
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const sizeLabel = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`);
const cleanName = (name: string) => name.replace(/[\u0000-\u001f"\\/]/g, '_').slice(0, 120) || 'file';

const receive = (kind: 'receipt' | 'document') => [upload.any(), async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const file = (req.files as Express.Multer.File[] | undefined)?.[0];
  if (!file) throw new AppError(422, 'FILE_REQUIRED', 'Please choose a file to upload.');
  const ext = extname(file.originalname).toLowerCase();
  const type = TYPES[ext];
  if (!type) throw new AppError(422, 'FILE_TYPE_NOT_ALLOWED', 'That file type is not allowed. Use PDF, image, Word, Excel, CSV or text files.');
  if (type.magic && !type.magic(file.buffer)) throw new AppError(422, 'FILE_CONTENT_MISMATCH', 'This file does not look like a real ' + ext.slice(1).toUpperCase() + ' file.');
  const id = newId('file');
  const key = `${user.companyId ?? 'platform'}/${id}${ext}`;
  await storage.put(key, file.buffer);
  await insert('files', { id, companyId: user.companyId, ownerId: user.id, kind, name: cleanName(file.originalname), mime: type.mime, size: file.size, storageKey: key, createdAt: nowIso() }, 'file');
  ok(res, { fileUrl: `/files/${id}`, fileSize: sizeLabel(file.size), name: cleanName(file.originalname) }, 201);
}];
filesRouter.post('/files/receipts', ...receive('receipt'));
filesRouter.post('/files/documents', ...receive('document'));

filesRouter.get('/files/:id', async (req, res) => {
  const user = me(req);
  const file = await byId('files', String(req.params.id));
  if (!file || (file.companyId !== user.companyId && user.role !== 'SUPER_ADMIN')) throw notFound('File');
  if (file.ownerId !== user.id && user.role !== 'SUPER_ADMIN') {
    const perms = await effectivePermissions(user);
    if (!can(perms, file.kind === 'receipt' ? 'EXPENSE_MANAGEMENT.VIEW' : 'DOCUMENTS.VIEW')) throw forbidden('You do not have access to this file.', 'SCOPE_DENIED');
  }
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/[^\w. -]/g, '_')}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  const stream = storage.stream(file.storageKey);
  stream.on('error', () => { if (!res.headersSent) res.status(404).json({ error: { code: 'FILE_MISSING', message: 'This file is no longer available.', requestId: req.ctx.requestId } }); else res.end(); });
  stream.pipe(res);
});

/** A file reference from the client is only accepted if it is a real upload from this company. */
export async function assertOwnFile(fileUrl: string | null | undefined, companyId: string, kind?: 'receipt' | 'document') {
  if (!fileUrl) return null;
  const id = /^\/files\/([\w-]+)$/.exec(fileUrl)?.[1];
  const file = id ? await byId('files', id) : null;
  if (!file || file.companyId !== companyId || (kind && file.kind !== kind)) throw new AppError(422, 'FILE_NOT_FOUND', 'The attached file could not be found. Please upload it again.');
  return file;
}

// ── Documents ──────────────────────────────────────────────────────────
const docSchema = z.object({ name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(60), visibility: z.enum(['ALL', 'HR', 'MANAGEMENT', 'EMPLOYEE']).default('ALL'), version: z.string().max(20).optional(), fileUrl: z.string().max(200).nullish(), fileSize: z.string().max(30).nullish(), employeeId: z.string().nullish() });

async function listDocs(req: import('express').Request, res: import('express').Response, mine: boolean) {
  const user = me(req);
  const companyId = companyIdFor(req);
  const perms = await effectivePermissions(user);
  const manage = !mine && can(perms, 'DOCUMENTS.CREATE');
  const employee = await findOne('employees', { userId: user.id, companyId });
  const filter: Row = { companyId };
  if (!manage) filter.$or = [{ visibility: 'ALL' }, ...(employee ? [{ employeeId: employee.id }] : []), ...(['MANAGER', 'SUPERVISOR', 'HR', 'COMPANY_ADMIN', 'FINANCE'].includes(user.role) && !mine ? [{ visibility: 'MANAGEMENT' }] : []), ...(['HR', 'COMPANY_ADMIN'].includes(user.role) && !mine ? [{ visibility: 'HR' }] : [])];
  const search = String(req.query.search ?? '').trim();
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (typeof req.query.category === 'string' && req.query.category && req.query.category !== 'ALL') filter.category = req.query.category;
  const q = pageQuery(req.query);
  const [rows, total] = await Promise.all([find('documents', filter, { sort: { createdAt: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }), count('documents', filter)]);
  ok(res, { documents: rows, pagination: pagination(q, total) });
}
filesRouter.get('/documents', (req, res) => listDocs(req, res, false));
filesRouter.get('/documents/mine', (req, res) => listDocs(req, res, true));

filesRouter.post('/documents', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(docSchema, req.body);
  await assertOwnFile(body.fileUrl, companyId, 'document');
  if (body.employeeId && !(await findOne('employees', { _id: body.employeeId, companyId }))) throw notFound('Employee');
  const row = await insert('documents', { companyId, ...body, uploadedBy: user.name, uploadedById: user.id, createdAt: nowIso() }, 'document');
  await appendAudit({ actorId: user.id, companyId, action: 'DOCUMENT_ADDED', entityType: 'DOCUMENT', entityId: row.id, newValue: { name: row.name, category: row.category, visibility: row.visibility }, ...reqMeta(req) });
  ok(res, row, 201);
});

filesRouter.delete('/documents/:id', async (req, res) => {
  const user = me(req);
  if (!can(await effectivePermissions(user), 'DOCUMENTS.DELETE')) throw forbidden('You need permission to delete documents.');
  const doc = await findOne('documents', { _id: String(req.params.id), companyId: user.companyId });
  if (!doc) throw notFound('Document');
  await remove('documents', { _id: doc.id });
  const fileId = /^\/files\/([\w-]+)$/.exec(doc.fileUrl ?? '')?.[1];
  const file = fileId ? await byId('files', fileId) : null;
  if (file) { await storage.remove(file.storageKey); await remove('files', { _id: file.id }); }
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'DOCUMENT_DELETED', entityType: 'DOCUMENT', entityId: doc.id, oldValue: { name: doc.name }, ...reqMeta(req) });
  ok(res, null);
});
