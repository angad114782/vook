import { findOne, insert } from '../db/repo.ts';
import { appendAudit } from '../domain/access.ts';
import { hashPassword } from '../lib/password.ts';
import { nowIso } from '../lib/serialize.ts';

/** Creates a platform admin (Super Admin). The only way to get the first real account on a server that has no demo data. */
export async function createSuperAdmin(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new Error('Enter the admin’s name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (input.password.length < 12 || !/[a-z]/i.test(input.password) || !/\d/.test(input.password)) throw new Error('The password needs at least 12 characters, with letters and a number.');
  if (await findOne('users', { emailLower: email })) throw new Error('A user with this email already exists.');
  const user = await insert('users', { name, email, emailLower: email, role: 'SUPER_ADMIN', companyId: null, isActive: true, passwordHash: await hashPassword(input.password), twoFactorEnabled: false, failedLogins: 0, createdAt: nowIso() }, 'user');
  await appendAudit({ actorId: user.id, companyId: null, action: 'SUPER_ADMIN_CREATED', entityType: 'USER', entityId: user.id, newValue: { email } });
  return user;
}
