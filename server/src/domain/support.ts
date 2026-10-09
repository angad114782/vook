import { coll } from '../db/mongo.ts';
import { findOne, insert, type Row } from '../db/repo.ts';
import { notify } from '../lib/notify.ts';
import { nowIso } from '../lib/serialize.ts';

/** Who may open a ticket: platform staff, the company admin of that company, or the person who raised it. */
export const sees = (user: Row, t: Row) => user.role === 'SUPER_ADMIN' || (t.companyId === user.companyId && (user.role === 'COMPANY_ADMIN' || t.userId === user.id));

export async function addComment(user: Row, ticket: Row, input: { body: string; clientMessageId?: string; isInternal?: boolean }) {
  if (input.clientMessageId) {
    const existing = await findOne('comments', { ticketId: ticket.id, 'authorId.id': user.id, clientMessageId: input.clientMessageId });
    if (existing) return existing; // retry of the same message — return the original
  }
  const comment = await insert('comments', { ticketId: ticket.id, body: input.body, clientMessageId: input.clientMessageId, isInternal: user.role === 'SUPER_ADMIN' && Boolean(input.isInternal), createdAt: nowIso(), authorId: { id: user.id, name: user.name, role: user.role } }, 'comment');
  await coll('tickets').updateOne({ _id: ticket.id }, { $set: { updatedAt: nowIso(), ...(ticket.status === 'RESOLVED' && user.role !== 'SUPER_ADMIN' ? { status: 'PENDING' } : {}) } });
  const other = user.role === 'SUPER_ADMIN' ? ticket.userId : null;
  if (other && !comment.isInternal) await notify({ userId: other, companyId: ticket.companyId, type: 'SUPPORT', title: `New reply on ${ticket.ticketNo}`, message: input.body.slice(0, 140), data: { ticketId: ticket.id, commentId: comment.id } });
  return comment;
}

