import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** One-click role sign-in for this computer only. Works only in development, only from the same machine; set to off to remove it. */
  DEV_QUICK_LOGIN: z.enum(['on', 'off']).default('on'),
  PORT: z.coerce.number().int().default(4000),
  /** Which network address to listen on. Use 127.0.0.1 when Nginx is on the same machine, so the API cannot be reached except through it. */
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().min(1).default('vook'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  // How many extra sample employees the demo seed adds on top of the 12 hand-written ones (0 = small data set).
  SEED_EMPLOYEES: z.coerce.number().int().min(0).max(2000).default(200),
  // Bot protection on sign-in, OTP and password-reset: `auto` = on everywhere except automated tests.
  BOT_GUARD: z.enum(['auto', 'on', 'off']).default('auto'),
  // Optional Cloudflare Turnstile (adds a visible-when-needed CAPTCHA on top of the built-in proof-of-work check).
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  // Number of reverse proxies in front of the API (so the real client IP is read correctly). 0 = none.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(15).default(5),
  // Demo companies and people with a known password. On by default for local work, OFF by default in production (an explicit SEED_DEMO=true is needed).
  SEED_DEMO: z.enum(['true', 'false']).optional(),
  LOG_LEVEL: z.string().default('info'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  // 32 random bytes, base64. Encrypts provider secrets (payment keys, SMTP passwords) at rest. Required in production.
  SECRETS_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message; never print values (they may contain secrets).
  console.error('Invalid environment configuration:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}

export const env = { ...parsed.data, SEED_DEMO: parsed.data.SEED_DEMO ? parsed.data.SEED_DEMO === 'true' : parsed.data.NODE_ENV !== 'production' };
if (env.NODE_ENV === 'production' && (!env.SECRETS_KEY || Buffer.from(env.SECRETS_KEY, 'base64').length !== 32)) {
  console.error('SECRETS_KEY must be 32 random bytes encoded as base64 in production.');
  process.exit(1);
}
export const isProd = env.NODE_ENV === 'production';
if (isProd && env.SEED_DEMO) console.warn('WARNING: SEED_DEMO=true in production. Demo accounts with a known password will be created on an empty database.');
if (isProd && env.COOKIE_SECURE === false) console.warn('WARNING: COOKIE_SECURE is false in production. Set COOKIE_SECURE=true behind HTTPS.');
