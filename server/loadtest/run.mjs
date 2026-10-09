// Concurrency test: N signed-in virtual users doing a realistic mix of reads and a few writes.
// It never goes through /auth/login (that route is deliberately rate-limited); it inserts sessions directly,
// which is equivalent to N people who already signed in.
//
//   node loadtest/run.mjs --users 1000 --seconds 60 [--base http://localhost:4000]
//   Add --local to start a throw-away in-memory MongoDB + API for an app-only measurement.
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
import http from 'node:http';
// A bounded keep-alive pool (like a browser or load balancer would use) instead of one socket per virtual user.
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
const call = (base, method, path, headers) => new Promise((resolve, reject) => {
  const req = http.request(new URL(path, base), { method, headers, agent }, (res) => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); });
  req.on('error', reject); req.setTimeout(30_000, () => req.destroy(new Error('timeout'))); req.end();
});
const require = createRequire(import.meta.url);

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const USERS = Number(arg('users', 200)), SECONDS = Number(arg('seconds', 30)), LOCAL = process.argv.includes('--local');
const THINK = Number(arg('think', -1)); // ms between clicks; default is a human-like 0.8–2.5 s, `--think 0` hammers (stress/spike)
let BASE = arg('base', 'http://localhost:4000');

let stopLocal = async () => {};
if (LOCAL) {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'vook_load';
  process.env.NODE_ENV = 'production-like-local';
  process.env.PORT = '4100';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.SEED_DEMO = 'true';
  const { spawn } = await import('node:child_process');
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' }); // measure the same bundle that ships, not the dev runner
  const child = spawn(process.execPath, ['dist/index.js'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'development', LOG_LEVEL: 'error' }, stdio: ['ignore', 'inherit', 'inherit'] });
  BASE = 'http://localhost:4100';
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/ready`)).ok) break; } catch {} await sleep(1000); }
  stopLocal = async () => { child.kill('SIGTERM'); await mongod.stop(); };
}

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: `${ROOT}.env` });
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);

// ── N signed-in sessions spread across the seven demo roles ──
const users = await db.collection('users').find({ companyId: { $ne: null } }).toArray();
const sessions = [];
const docs = [];
for (let i = 0; i < USERS; i++) {
  const user = users[i % users.length];
  const token = randomBytes(32).toString('base64url');
  const csrf = randomBytes(24).toString('base64url');
  docs.push({ _id: createHash('sha256').update(token).digest('hex'), userId: user._id, csrfToken: csrf, createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000), ip: '127.0.0.1', userAgent: 'loadtest' });
  sessions.push({ token, csrf, role: user.role });
}
await db.collection('sessions').insertMany(docs);

const READS = {
  common: ['/api/v2/access', '/api/v2/notifications?limit=20', '/api/v2/auth/session'],
  EMPLOYEE: ['/api/v2/attendance/mine', '/api/v2/leave-requests/mine', '/api/v2/payslips/mine', '/api/v2/expenses/mine', '/api/v2/documents/mine'],
  HR: ['/api/v2/dashboard', '/api/v2/employees?limit=20', '/api/v2/attendance/summary', '/api/v2/leave-requests?limit=20', '/api/v2/approvals?limit=20'],
  FINANCE: ['/api/v2/payroll-runs', '/api/v2/payslips?limit=20', '/api/v2/expenses?limit=20', '/api/v2/salaries?limit=20'],
  MANAGER: ['/api/v2/employees?limit=20', '/api/v2/approvals?limit=20', '/api/v2/attendance/summary'],
  SUPERVISOR: ['/api/v2/employees?limit=20', '/api/v2/approvals?limit=20', '/api/v2/shifts'],
  COMPANY_ADMIN: ['/api/v2/dashboard', '/api/v2/users?limit=20', '/api/v2/employees?limit=20', '/api/v2/activity-events?limit=20'],
};

const latencies = [];
const byStatus = new Map();
let errors = 0, total = 0;
const deadline = Date.now() + SECONDS * 1000;

async function vu(s) {
  const pool = [...READS.common, ...(READS[s.role] ?? [])];
  const headers = { cookie: `vook_sid=${s.token}` };
  while (Date.now() < deadline) {
    const path = pool[Math.floor(Math.random() * pool.length)];
    const write = Math.random() < 0.04; // ~4% writes
    const started = performance.now();
    try {
      const res = write
        ? await call(BASE, 'PATCH', '/api/v2/notifications/read-all', { ...headers, 'x-csrf-token': s.csrf })
        : await call(BASE, 'GET', path, headers);
      latencies.push(performance.now() - started);
      byStatus.set(res.status, (byStatus.get(res.status) ?? 0) + 1);
      if (res.status >= 500) errors++; // 429 is the designed overload answer, not a failure
    } catch { errors++; latencies.push(performance.now() - started); }
    total++;
    await sleep(THINK >= 0 ? THINK : 800 + Math.random() * 1700); // think time: a person reads the screen before the next click
  }
}

console.log(`Running ${USERS} signed-in users for ${SECONDS}s against ${BASE} …`);
const t0 = Date.now();
await Promise.all(sessions.map((s, i) => sleep(THINK === 0 ? 0 : (i / USERS) * 5000).then(() => vu(s)))); // ramp over 5 s (all at once for a spike)
const elapsed = (Date.now() - t0) / 1000;
latencies.sort((a, b) => a - b);
const q = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]?.toFixed(0);
const health = await (await fetch(`${BASE}/health`)).json().catch(() => ({ status: 'DOWN' }));
console.log(`requests: ${total}  throughput: ${(total / elapsed).toFixed(0)}/s  server errors+network failures: ${errors}  (${((errors / total) * 100).toFixed(2)}%)`);
console.log(`latency ms → p50 ${q(50)}  p95 ${q(95)}  p99 ${q(99)}  max ${latencies.at(-1)?.toFixed(0)}`);
console.log('status codes:', Object.fromEntries([...byStatus].sort()));
console.log('server still healthy after test:', health.status);
await db.collection('sessions').deleteMany({ userAgent: 'loadtest' });
await client.close();
await stopLocal();
const p95 = Number(q(95));
process.exit(errors / total < 0.001 && (THINK === 0 || p95 < 500) && health.status === 'ok' ? 0 : 1);
