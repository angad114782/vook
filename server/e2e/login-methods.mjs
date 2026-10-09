// Real Chrome checks of every way to sign in, with bot protection ON (the browser must solve the puzzle by itself).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('../../node_modules/playwright');
const BASE = process.env.APP_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const fresh = async () => { const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } }); return { ctx, page: await ctx.newPage() }; };
const landed = (page) => page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }).then(() => new URL(page.url()).pathname).catch(() => 'stayed on /login');

{ // 1. email + password
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'hrc@vook.com'); await page.fill('#login-password', 'Demo@123'); await page.click('button[type=submit]');
  const p = await landed(page); check('email + password', p === '/hr/dashboard', p); await ctx.close();
}
{ // 2. mobile + password
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', '+91 90000 10003'); await page.fill('#login-password', 'Demo@123'); await page.click('button[type=submit]');
  const p = await landed(page); check('mobile + password (+91 90000 10003)', p === '/manager/dashboard', p); await ctx.close();
}
{ // 3. wrong password → friendly message
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', '9000010001'); await page.fill('#login-password', 'wrong-pass-1'); await page.click('button[type=submit]');
  await page.waitForSelector('.login-error', { timeout: 15000 }).catch(() => {});
  const msg = (await page.textContent('.login-error').catch(() => '')) ?? '';
  check('wrong password shows a plain message', /not correct/i.test(msg) && !/401|status code/i.test(msg), msg.trim()); await ctx.close();
}
{ // 4. mobile OTP (SMS) end to end
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.click('role=tab[name="Mobile code"]');
  await page.fill('#otp-mobile', '90000 10004');
  await page.click('button:has-text("Text message")');
  await page.click('button:has-text("Send code")');
  await page.waitForSelector('#otp-code', { timeout: 15000 });
  const text = await page.innerText('body');
  const code = /Your code is\s+(\d{6})/.exec(text)?.[1];
  check('OTP screen appears and shows the test-mode code', Boolean(code), code ?? 'no code');
  if (code) {
    await page.fill('#otp-code', '000000' === code ? '111111' : '000000'); await page.click('button:has-text("Verify and sign in")');
    await page.waitForSelector('.login-error', { timeout: 10000 }).catch(() => {});
    check('wrong code is refused politely', /not correct|expired/i.test((await page.textContent('.login-error').catch(() => '')) ?? ''));
    await page.fill('#otp-code', code); await page.click('button:has-text("Verify and sign in")');
    const p = await landed(page); check('correct code signs in (supervisor)', p === '/supervisor/dashboard', p);
  }
  await ctx.close();
}
{ // 5. resend cool-down is shown
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.click('role=tab[name="Mobile code"]'); await page.fill('#otp-mobile', '90000 10002'); await page.click('button:has-text("Send code")');
  await page.waitForSelector('#otp-code', { timeout: 15000 });
  check('resend countdown is visible', /Send a new code in \d+s/.test(await page.innerText('body'))); await ctx.close();
}
{ // 6. forgot password link works with bot protection on
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'emp@vook.com'); await page.click('button[type=submit]');
  await page.waitForSelector('text=Check your inbox', { timeout: 15000 }).catch(() => {});
  check('forgot password gives the test link', await page.isVisible('text=Set a new password')); await ctx.close();
}
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
