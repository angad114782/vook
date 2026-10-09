import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toV2ResourcePath } from '../../src/api/routes.ts';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

const SRC = resolve(__dirname, '../../src');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === 'mocks' || f === 'contracts' ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
});

/** Every `api.<verb>('/path')` the React app makes, translated the same way axios does. */
function frontendCalls() {
  const found = new Map<string, { method: string; path: string; file: string }>();
  const re = /\bapi\s*\.\s*(get|post|put|patch|delete)\s*(?:<[\s\S]*?>)?\s*\(\s*([`'"])([^`'"]*?)\2/g;
  for (const file of [...walk(join(SRC, 'api')), ...walk(join(SRC, 'pages')), ...walk(join(SRC, 'hooks')), ...walk(join(SRC, 'components'))]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) {
      const raw = m[3]!.replace(/\$\{[^}]*\}/g, 'x').split('?')[0]!;
      if (!raw.startsWith('/')) continue;
      const path = toV2ResourcePath(raw);
      found.set(`${m[1]!.toUpperCase()} ${path}`, { method: m[1]!.toUpperCase(), path, file: file.replace(SRC, 'src') });
    }
  }
  return [...found.values()];
}

describe('server covers every call the frontend makes', () => {
  it('has a route for each (method, path) the React app uses', async () => {
    const calls = frontendCalls();
    expect(calls.length).toBeGreaterThan(80);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const missing: string[] = [];
    for (const call of calls) {
      if (call.path.startsWith('/demo/') || call.path === '/auth/login' || call.path === '/payroll-runs/x/x') continue; // mock-only / covered elsewhere
      if (call.path.includes('/auth/security/revoke-all') || call.path.includes('/auth/logout')) continue; // would end this test session
      const res = await sa.agent[call.method.toLowerCase() as 'get'](`/api/v2${call.path}`).send(call.method === 'GET' ? undefined : {});
      if (res.status === 404 && res.body?.error?.message === 'This endpoint does not exist.') missing.push(`${call.method} ${call.path}  (${call.file})`);
    }
    expect(missing, `Frontend calls with no server route:\n${missing.join('\n')}`).toEqual([]);
  });
});
