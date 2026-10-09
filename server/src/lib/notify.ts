import { insert, type Row } from '../db/repo.ts';
import { nowIso } from './serialize.ts';

type Emitter = (userId: string, notification: Row) => void;
let emitter: Emitter | null = null;
/** The realtime gateway registers itself here so domain code never imports socket.io directly. */
export const setNotificationEmitter = (fn: Emitter | null) => { emitter = fn; };

export async function notify(input: { userId: string; companyId?: string | null; type: string; title: string; message: string; data?: Row }) {
  const row = await insert('notifications', { companyId: input.companyId ?? null, isRead: false, data: {}, ...input, createdAt: nowIso() }, 'notification');
  try { emitter?.(input.userId, row); } catch { /* realtime is best-effort; the stored notification is the source of truth */ }
  return row;
}
