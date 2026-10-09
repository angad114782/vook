import nodemailer from 'nodemailer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('mail worker', () => {
  it('waits while no SMTP integration is active, then delivers once and never twice', async () => {
    const { coll } = await import('../src/db/mongo.ts');
    const { insert } = await import('../src/db/repo.ts');
    const { sendMail } = await import('../src/lib/mail.ts');
    const { deliverQueuedMail } = await import('../src/workers/mail.ts');
    const { encryptSecret } = await import('../src/lib/secrets.ts');
    const outbox: unknown[] = [];
    const fake = () => { const t = nodemailer.createTransport({ jsonTransport: true }); const send = t.sendMail.bind(t); t.sendMail = (async (m: never) => { outbox.push(m); return send(m); }) as never; return t; };

    await sendMail({ to: 'a@example.com', subject: 'Hello', text: 'Body', link: 'https://app.example/x' });
    expect(await deliverQueuedMail(fake)).toEqual({ sent: 0, failed: 0 }); // no SMTP yet: message stays queued
    expect((await coll('mailOutbox').findOne({ to: 'a@example.com' }))!.status).toBe('QUEUED');

    await insert('integrations', { providerKey: 'SMTP', status: 'ACTIVE', publicConfig: { host: 'smtp.example.com', port: 587, fromAddress: 'hello@vook.app' }, secrets: { username: encryptSecret('u'), password: encryptSecret('p') } }, 'integration');
    const [a, b] = await Promise.all([deliverQueuedMail(fake), deliverQueuedMail(fake)]);
    expect(a.sent + b.sent).toBe(1); // atomic claim: exactly one worker sends it
    expect(outbox).toHaveLength(1);
    expect(JSON.stringify(outbox[0])).toContain('https://app.example/x');
    expect((await coll('mailOutbox').findOne({ to: 'a@example.com' }))!.status).toBe('SENT');

    await sendMail({ to: 'b@example.com', subject: 'Retry me', text: 'Body' });
    const broken = () => { const t = nodemailer.createTransport({ jsonTransport: true }); t.sendMail = (async () => { throw new Error('smtp down'); }) as never; return t; };
    expect((await deliverQueuedMail(broken)).failed).toBe(1);
    const retried = await coll('mailOutbox').findOne({ to: 'b@example.com' });
    expect(retried!.status).toBe('RETRY');
    expect(new Date(retried!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now()); // backs off instead of hammering the server
  });
});
