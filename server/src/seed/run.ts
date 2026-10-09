import { env } from '../config/env.ts';
import { closeDb, connectDb } from '../db/mongo.ts';
import { ensureIndexes } from '../db/indexes.ts';
import { resetAndSeed, seedIfEmpty } from './seed.ts';

const reset = process.argv.includes('--reset');
const idx = process.argv.indexOf('--employees');
const employees = idx > 0 ? Number(process.argv[idx + 1]) : env.SEED_EMPLOYEES; // npm run seed -- --reset --employees 200
if (reset && process.env.NODE_ENV === 'production') { console.error('Refusing to reset a production database.'); process.exit(1); }
await connectDb(env.MONGODB_URI, env.MONGODB_DB);
await ensureIndexes();
if (reset) { await resetAndSeed(employees); console.log('Database reset and demo data seeded.'); }
else console.log((await seedIfEmpty(employees)) ? 'Demo data seeded.' : 'Database already has data; nothing to do.');
await closeDb();
