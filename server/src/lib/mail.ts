import { insert } from '../db/repo.ts';
import { logger } from './logger.ts';
import { env, isProd } from '../config/env.ts';

/**
 * Mail port. Messages are queued in `mailOutbox`; a worker/SMTP adapter delivers them once the SMTP integration is active.
 * In development the message is also logged so reset/invitation links can be used without an SMTP server.
 */
export async function sendMail(msg: { to: string; subject: string; text: string; link?: string }) {
  await insert('mailOutbox', { ...msg, status: 'QUEUED', createdAt: new Date().toISOString() }, 'mail');
  if (!isProd && env.NODE_ENV !== 'test') logger.info({ to: msg.to, subject: msg.subject, link: msg.link }, 'mail queued (dev)');
}
