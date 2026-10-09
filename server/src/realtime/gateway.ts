import { createHash } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { coll } from '../db/mongo.ts';
import { byId, out, type Row } from '../db/repo.ts';
import { addComment, sees } from '../domain/support.ts';
import { logger } from '../lib/logger.ts';
import { setNotificationEmitter } from '../lib/notify.ts';
import { nowIso } from '../lib/serialize.ts';

let io: Server | null = null;

/** Sends a ticket event to everyone in the ticket room; internal notes go to platform staff only. */
export function emitToTicket(ticketId: string, event: string, payload: unknown, internalOnly = false) {
  if (!io) return;
  io.to(internalOnly ? `ticket:${ticketId}:staff` : `ticket:${ticketId}`).emit(event, payload);
}

const cookieValue = (header: string | undefined, name: string) => header?.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1);

export function initRealtime(server: HttpServer) {
  io = new Server(server, { path: '/socket.io', cors: { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }, maxHttpBufferSize: 64 * 1024, pingInterval: 25_000, pingTimeout: 20_000 });

  // Identity comes from the same session cookie as the REST API — never from anything the client sends.
  io.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.handshake.headers.cookie, 'vook_sid');
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const session = await coll('sessions').findOne({ _id: createHash('sha256').update(decodeURIComponent(token)).digest('hex') });
      if (!session || session.expiresAt.getTime() < Date.now()) return next(new Error('UNAUTHENTICATED'));
      const user = await coll('users').findOne({ _id: session.userId }, { projection: { passwordHash: 0, totpSecret: 0 } });
      if (!user || user.isActive === false) return next(new Error('UNAUTHENTICATED'));
      socket.data.user = out(user);
      next();
    } catch (err) { next(err as Error); }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as Row;
    void socket.join(`user:${user.id}`);
    let burst = 0;
    const window = setInterval(() => { burst = 0; }, 10_000);
    const limited = () => ++burst > 60;
    const rooms = new Set<string>();

    const guarded = <T extends z.ZodType>(schema: T, handler: (data: z.infer<T>) => Promise<unknown>) => async (raw: unknown, ack?: (r: unknown) => void) => {
      const reply = (r: unknown) => { if (typeof ack === 'function') ack(r); };
      if (limited()) return reply({ ok: false, code: 'RATE_LIMITED', message: 'You are sending too fast. Please slow down.' });
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, code: 'VALIDATION_ERROR', message: 'That message could not be read.' });
      try { reply(await handler(parsed.data)); } catch (err) { logger.error({ err }, 'socket handler failed'); reply({ ok: false, code: 'INTERNAL', message: 'Something went wrong. Please try again.' }); }
    };
    const ticketFor = async (ticketId: string) => { const t = await byId('tickets', ticketId); return t && sees(user, t) ? t : null; };
    const id = z.object({ ticketId: z.string().min(1).max(80) });

    socket.on('support:join', guarded(id, async ({ ticketId }) => {
      const ticket = await ticketFor(ticketId);
      if (!ticket) return { ok: false, code: 'NOT_FOUND', message: 'Ticket not found.' };
      await socket.join(`ticket:${ticketId}`);
      if (user.role === 'SUPER_ADMIN') await socket.join(`ticket:${ticketId}:staff`);
      rooms.add(ticketId);
      socket.to(`ticket:${ticketId}`).emit('support:presence', { ticketId, userId: user.id, online: true });
      return { ok: true };
    }));
    socket.on('support:leave', guarded(id, async ({ ticketId }) => {
      await socket.leave(`ticket:${ticketId}`); await socket.leave(`ticket:${ticketId}:staff`); rooms.delete(ticketId);
      socket.to(`ticket:${ticketId}`).emit('support:presence', { ticketId, userId: user.id, online: false });
      return { ok: true };
    }));
    socket.on('support:comment', guarded(z.object({ ticketId: z.string().min(1).max(80), body: z.string().trim().min(1).max(5000), clientMessageId: z.string().min(1).max(80), isInternal: z.boolean().optional() }), async (d) => {
      const ticket = await ticketFor(d.ticketId);
      if (!ticket) return { ok: false, code: 'NOT_FOUND', message: 'Ticket not found.' };
      const comment = await addComment(user, ticket, d);
      emitToTicket(ticket.id, 'support:comment', comment, comment.isInternal);
      return { ok: true, comment };
    }));
    socket.on('support:typing', guarded(z.object({ ticketId: z.string().min(1).max(80), isTyping: z.boolean() }), async ({ ticketId, isTyping }) => {
      if (!rooms.has(ticketId)) return { ok: false };
      socket.to(`ticket:${ticketId}`).emit('support:typing', { ticketId, userId: user.id, name: user.name, isTyping });
      return { ok: true };
    }));
    const cursor = (kind: 'read' | 'delivered') => async (ticketId: string, messageId: string | null) => {
      const at = nowIso();
      const field = kind === 'read' ? { lastReadMessageId: messageId, lastReadAt: at } : { lastDeliveredMessageId: messageId, lastDeliveredAt: at };
      await coll('tickets').updateOne({ _id: ticketId }, { $pull: { readCursors: { userId: user.id } } } as never);
      await coll('tickets').updateOne({ _id: ticketId }, { $push: { readCursors: { userId: user.id, ...field } } } as never);
      emitToTicket(ticketId, kind === 'read' ? 'support:read:cursor' : 'support:delivered:cursor', { ticketId, userId: user.id, messageId, at });
    };
    socket.on('support:read', guarded(id, async ({ ticketId }) => {
      if (!(await ticketFor(ticketId))) return { ok: false, code: 'NOT_FOUND', message: 'Ticket not found.' };
      const last = await coll('comments').find({ ticketId }).sort({ createdAt: -1 }).limit(1).next();
      await cursor('read')(ticketId, last?._id ?? null);
      return { ok: true };
    }));
    socket.on('support:delivered', guarded(z.object({ ticketId: z.string().min(1).max(80), messageId: z.string().min(1).max(80) }), async ({ ticketId, messageId }) => {
      if (!(await ticketFor(ticketId))) return { ok: false, code: 'NOT_FOUND', message: 'Ticket not found.' };
      await cursor('delivered')(ticketId, messageId);
      return { ok: true };
    }));

    socket.on('disconnect', () => {
      clearInterval(window);
      for (const ticketId of rooms) socket.to(`ticket:${ticketId}`).emit('support:presence', { ticketId, userId: user.id, online: false });
    });
  });

  setNotificationEmitter((userId, notification) => { io?.to(`user:${userId}`).emit('notification:created', out(notification)); });
  return io;
}

export async function closeRealtime() { setNotificationEmitter(null); await io?.close(); io = null; }
