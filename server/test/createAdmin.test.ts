import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('first real admin on a server without demo data', () => {
  it('creates a Super Admin who can sign in, and refuses weak passwords and duplicates', async () => {
    const { createSuperAdmin } = await import('../src/seed/createAdmin.ts');
    await expect(createSuperAdmin({ name: 'Owner', email: 'owner@example.com', password: 'short1' })).rejects.toThrow(/12 characters/);
    await expect(createSuperAdmin({ name: 'Owner', email: 'not-an-email', password: 'a-long-password-1' })).rejects.toThrow(/valid email/);
    const user = await createSuperAdmin({ name: 'Owner', email: 'Owner@Example.com', password: 'a-long-password-1' });
    expect(user.role).toBe('SUPER_ADMIN');
    await expect(createSuperAdmin({ name: 'Owner', email: 'owner@example.com', password: 'a-long-password-1' })).rejects.toThrow(/already exists/);
    const session = await loginAs(ctx.app, 'owner@example.com', 'a-long-password-1');
    expect(session.user.role).toBe('SUPER_ADMIN');
  });
});
