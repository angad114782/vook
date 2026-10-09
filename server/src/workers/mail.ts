import nodemailer, { type Transporter } from 'nodemailer';
import { coll } from '../db/mongo.ts';
import { findOne, type Row } from '../db/repo.ts';
import { logger } from '../lib/logger.ts';
import { integrationSecrets } from '../payments/provider.ts';

const MAX_ATTEMPTS = 5;
type TransportFactory = (config: { host: string; port: number; user: string; pass: string; from: string }) => Transporter;
const smtpTransport: TransportFactory = ({ host, port, user, pass }) =>
  nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined, connectionTimeout: 10_000, socketTimeout: 15_000 });

/**
 * Delivers queued emails through the active SMTP integration.
 * Without one the messages simply wait in the queue (development prints the link in the log instead).
 * Each message is claimed atomically, so several API instances can run this safely; failures retry with backoff.
 */
export async function deliverQueuedMail(makeTransport: TransportFactory = smtpTransport, batch = 20) {
  const smtp = await findOne('integrations', { providerKey: 'SMTP', status: 'ACTIVE' });
  if (!smtp?.publicConfig?.host) return { sent: 0, failed: 0 };
  const secrets = integrationSecrets(smtp);
  const from = String(smtp.publicConfig.fromAddress ?? 'no-reply@localhost');
  const transport = makeTransport({ host: String(smtp.publicConfig.host), port: Number(smtp.publicConfig.port) || 587, user: secrets.username ?? '', pass: secrets.password ?? '', from });
  let sent = 0, failed = 0;
  for (let i = 0; i < batch; i++) {
    const now = new Date().toISOString();
    const mail = await coll('mailOutbox').findOneAndUpdate(
      { status: { $in: ['QUEUED', 'RETRY'] }, $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
      { $set: { status: 'SENDING', claimedAt: now }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
    if (!mail) break;
    const m = mail as Row;
    try {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.link ? `${m.text}\n\n${m.link}` : m.text });
      await coll('mailOutbox').updateOne({ _id: mail._id }, { $set: { status: 'SENT', sentAt: new Date().toISOString() } });
      sent++;
    } catch (err) {
      failed++;
      const attempts = Number(m.attempts ?? 1);
      await coll('mailOutbox').updateOne({ _id: mail._id }, { $set: { status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRY', lastError: String((err as Error).message).slice(0, 200), nextAttemptAt: new Date(Date.now() + 2 ** attempts * 30_000).toISOString() } });
      logger.warn({ to: m.to, attempts }, 'email delivery failed');
    }
  }
  return { sent, failed };
}
