import request from 'supertest';
import type { Express } from 'express';

export const DEMO_PASSWORD = 'Demo@123';
export const ACCOUNTS = {
  superAdmin: 'superadmin@demo.vook.app',
  companyAdmin: 'companyadmin@demo.vook.app',
  hr: 'hr@demo.vook.app',
  finance: 'finance@demo.vook.app',
  manager: 'manager@demo.vook.app',
  supervisor: 'supervisor@demo.vook.app',
  employee: 'employee@demo.vook.app',
} as const;

/** Starts an isolated app on its own database (dropped by `stop`). Env must be set before config is imported. */
export async function boot(overrides: Record<string, string> = {}) {
  process.env.NODE_ENV = 'test';
  process.env.BOT_GUARD = 'off';
  Object.assign(process.env, overrides);
  process.env.MONGODB_DB = `vook_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  process.env.SEED_DEMO = 'true';
  const { env } = await import('../src/config/env.ts');
  const { connectDb, closeDb, db } = await import('../src/db/mongo.ts');
  const { ensureIndexes } = await import('../src/db/indexes.ts');
  const { seedDemo } = await import('../src/seed/seed.ts');
  const { createApp } = await import('../src/app.ts');
  await connectDb(env.MONGODB_URI, env.MONGODB_DB);
  await ensureIndexes();
  await seedDemo();
  const app = createApp();
  return {
    app,
    stop: async () => { await db().dropDatabase(); await closeDb(); },
  };
}

/** A cookie-keeping client that already signed in and sends the CSRF token on every call. */
export async function loginAs(app: Express, email: string, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v2/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  agent.set('X-CSRF-Token', res.body.data.csrfToken);
  return { agent, user: res.body.data.user, csrfToken: res.body.data.csrfToken as string };
}
