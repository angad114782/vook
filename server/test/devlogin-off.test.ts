import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); }); // NODE_ENV=test, like any non-development setup
afterAll(async () => { await ctx.stop(); });

describe('one-click sign-in is absent outside development', () => {
  it('does not exist at all', async () => {
    expect((await request(ctx.app).get('/api/v2/auth/dev-accounts')).status).toBe(404);
    expect((await request(ctx.app).post('/api/v2/auth/dev-login').send({ role: 'EMPLOYEE' })).status).toBe(404);
  });
});
