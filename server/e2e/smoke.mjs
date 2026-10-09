// Full-stack smoke: real Chrome → React app (API mode) → Express → MongoDB.
// Usage: node server/e2e/smoke.mjs   (API on :4000, frontend on :5173, demo data seeded)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('../../node_modules/playwright');

const BASE = process.env.APP_URL ?? 'http://localhost:5173';
const roles = [
  ['admin@vook.com'], ['cadmin@vook.com'], ['hrc@vook.com'], ['finc@vook.com'], ['mgr@vook.com'], ['sup@vook.com'], ['emp@vook.com'],
];

const only = process.argv.slice(2); // e.g. `hrc finc` to test only some roles (match on the start of the email)
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
for (const [email] of roles) {
  if (only.length && !only.some((o) => email.startsWith(o))) continue;
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) problems.push(`console: ${m.text().slice(0, 160)}`); }); // the 401 is the expected "not signed in yet" session check
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on('response', (r) => {
    const url = r.url();
    if (!url.includes('/api/v2/')) return;
    if (r.status() >= 400 && !(r.status() === 401 && /\/auth\/(session|refresh)/.test(url))) problems.push(`${r.status()} ${r.request().method()} ${url.replace(/^.*\/api\/v2/, '')}  on ${new URL(page.url()).pathname}`);
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[placeholder="admin@workmgmt.com"]', email);
  await page.fill('input[type="password"]', 'Demo@123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => problems.push('login did not leave /login'));
  await page.waitForLoadState('networkidle').catch(() => {});
  const landed = new URL(page.url()).pathname;
  // Visit every link in the sidebar once.
  await page.waitForSelector('a[href^="/"]:not([href="#main-content"])', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const links = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/') && !h.includes('#') && !/\/(logout|login)/.test(h)))]);
  const visited = [];
  for (const href of links.slice(0, 30)) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' }).catch(() => problems.push(`could not open ${href}`));
    const text = (await page.innerText('body').catch(() => '')).toLowerCase();
    if (/something went wrong|not found|access denied|unable to load/.test(text) && !/^\/(profile)/.test(href)) problems.push(`page text suggests an error on ${href}`);
    visited.push(href);
  }
  report.push({ email, landed, pagesVisited: visited.length, problems: [...new Set(problems)] });
  await context.close();
}
await browser.close();
for (const r of report) console.log(`${r.problems.length ? '✗' : '✓'} ${r.email.padEnd(30)} landed ${r.landed.padEnd(26)} pages ${r.pagesVisited}${r.problems.length ? '\n    ' + r.problems.join('\n    ') : ''}`);
process.exit(report.some((r) => r.problems.length) ? 1 : 0);
