import { coll } from '../db/mongo.ts';

/** Reserves `n` consecutive numbers atomically and returns the first one (safe under concurrent imports). */
export async function reserveSeq(key: string, n: number, seed: () => Promise<number>): Promise<number> {
  const c = coll('counters');
  if (!(await c.findOne({ _id: key }, { projection: { _id: 1 } }))) {
    await c.updateOne({ _id: key }, { $setOnInsert: { seq: await seed() } }, { upsert: true });
  }
  const res = await c.findOneAndUpdate({ _id: key }, { $inc: { seq: n } }, { returnDocument: 'after' });
  return (res!.seq as number) - n + 1;
}

/** Atomic per-key counter. `seed` runs once to start the sequence after existing records. */
export async function nextSeq(key: string, seed: () => Promise<number>): Promise<number> {
  const c = coll('counters');
  if (!(await c.findOne({ _id: key }, { projection: { _id: 1 } }))) {
    await c.updateOne({ _id: key }, { $setOnInsert: { seq: await seed() } }, { upsert: true });
  }
  const res = await c.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
  return res!.seq as number;
}
