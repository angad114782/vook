import { env } from '../config/env.ts';
import { closeDb, connectDb } from '../db/mongo.ts';
import { ensureIndexes } from '../db/indexes.ts';
import { createSuperAdmin } from './createAdmin.ts';

// Usage (on the server):  ADMIN_PASSWORD='a-long-password-1' npm run create-admin -- "Full Name" admin@yourdomain.com
// The password is read from the environment, never from the command line, so it does not end up in shell history.
const [name, email] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD ?? '';
if (!name || !email || !password) { console.error('Usage: ADMIN_PASSWORD=... npm run create-admin -- "Full Name" admin@example.com'); process.exit(1); }
try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB);
  await ensureIndexes();
  const user = await createSuperAdmin({ name, email, password });
  console.log(`Super Admin created: ${user.email}. Sign in, then turn on two-step sign-in under Account security.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally { await closeDb(); }
