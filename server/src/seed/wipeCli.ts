import { env } from '../config/env.ts';
import { closeDb, connectDb, coll, db } from '../db/mongo.ts';
import { appendAudit } from '../domain/access.ts';

// Wipes a database down to the Super Admin(s) and the integrations you choose to keep. Run it on the server, against the database in server/.env.
//
//   Preview (changes nothing):   npm run wipe:prod
//   Really delete:               CONFIRM_DB='<database name shown in the preview>' npm run wipe:prod
//
// Optional:  KEEP_EMAIL='me@example.com,other@example.com'   keep only these Super Admins (default: every SUPER_ADMIN)
//            KEEP_INTEGRATIONS='WHATSAPP'                    integrations (by providerKey) to keep; default WHATSAPP, 'none' keeps nothing
// Collections stay in place (with their indexes). After the wipe, restart the API once: it re-creates the module catalogue, starter plans,
// role templates and platform settings by itself (only while SEED_DEMO is off). Uploaded files on disk are not touched.
const keepEmails = (process.env.KEEP_EMAIL ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const keepProviders = (process.env.KEEP_INTEGRATIONS ?? 'WHATSAPP').split(',').map((e) => e.trim().toUpperCase()).filter((e) => e && e !== 'NONE');
const confirmed = process.env.CONFIRM_DB === env.MONGODB_DB;

try {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB);
  const admins = await coll('users').find({ role: 'SUPER_ADMIN', ...(keepEmails.length ? { emailLower: { $in: keepEmails } } : {}) }).toArray();
  if (!admins.length) throw new Error('No Super Admin to keep was found, so nothing was deleted. Check KEEP_EMAIL, or create one first with create-admin.');
  const keepIds = admins.map((a) => a._id);

  console.log(`Database: ${env.MONGODB_DB}`);
  console.log(`Keeping Super Admin: ${admins.map((a) => a.email).join(', ')}`);
  console.log(`Keeping integrations: ${keepProviders.join(', ') || 'none'}\n`);

  // What each collection keeps; everything else in it is deleted. Collections not listed here are emptied.
  const keepFilter: Record<string, object> = {
    users: { _id: { $in: keepIds } },
    sessions: { userId: { $in: keepIds } },
    integrations: { providerKey: { $in: keepProviders } },
  };
  const plan: Array<{ name: string; total: number; remove: number }> = [];
  for (const { name } of await db().listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith('system.')) continue;
    const total = await coll(name).countDocuments({});
    const keep = keepFilter[name] ? await coll(name).countDocuments(keepFilter[name]) : 0;
    plan.push({ name, total, remove: total - keep });
  }
  for (const row of plan.filter((r) => r.remove > 0)) console.log(`  ${row.name.padEnd(28)} delete ${String(row.remove).padStart(7)} of ${row.total}`);
  console.log(`\nTotal documents to delete: ${plan.reduce((n, r) => n + r.remove, 0)}`);

  if (!confirmed) {
    console.log(`\nPreview only, nothing was deleted. To delete for real, run:\n  CONFIRM_DB='${env.MONGODB_DB}' npm run wipe:prod`);
  } else {
    for (const row of plan.filter((r) => r.remove > 0)) {
      const keep = keepFilter[row.name];
      await coll(row.name).deleteMany(keep ? { $nor: [keep] } : {});
    }
    await appendAudit({ actorId: keepIds[0], companyId: null, action: 'PLATFORM_DATA_WIPED', entityType: 'PLATFORM', entityId: env.MONGODB_DB, newValue: { keptAdmins: admins.map((a) => a.email), keptIntegrations: keepProviders } });
    console.log('\nDone. Restart the API once so the starter plans and role templates are created again.');
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally { await closeDb(); }
