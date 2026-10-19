import { env } from '../config/env.ts';
import { closeDb, connectDb, coll } from '../db/mongo.ts';
import { appendAudit } from '../domain/access.ts';
import { findOne } from '../db/repo.ts';
import { hashPassword } from '../lib/password.ts';

// Usage (on the server):  NEW_PASSWORD='a-long-password-1' npm run set-password:prod -- admin@yourdomain.com
// For an account you can no longer sign in to. The password comes from the environment, never from the command line.
const [email] = process.argv.slice(2);
const password = process.env.NEW_PASSWORD ?? '';
if (!email || !password) { console.error('Usage: NEW_PASSWORD=... npm run set-password:prod -- user@example.com'); process.exit(1); }
try {
  if (password.length < 6 || !/[a-z]/i.test(password) || !/\d/.test(password)) throw new Error('The password needs at least 6 characters, with letters and a number.');
  await connectDb(env.MONGODB_URI, env.MONGODB_DB);
  const user = await findOne('users', { emailLower: email.trim().toLowerCase() });
  if (!user) throw new Error('No user with this email.');
  await coll('users').updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password), failedLogins: 0 }, $unset: { lockedUntil: '' } });
  await coll('sessions').deleteMany({ userId: user._id });
  await appendAudit({ actorId: user._id, companyId: user.companyId ?? null, action: 'PASSWORD_SET_BY_OPERATOR', entityType: 'USER', entityId: user._id, newValue: { email: user.email } });
  console.log(`Password updated for ${user.email}. Every old sign-in on this account was ended.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally { await closeDb(); }
