import { coll } from '../db/mongo.ts';

/**
 * Counters and blocks shared by every API instance (stored in MongoDB with a TTL), so limits survive restarts
 * and cannot be dodged by hitting a different server. `hit` returns the count inside the current window.
 */
export async function hit(key: string, windowMs: number): Promise<number> {
  const c = coll('authThrottle');
  const bump = () => c.findOneAndUpdate({ _id: key, expireAt: { $gt: new Date() } }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  const existing = await bump();
  if (existing) return existing.count as number;
  try {
    const fresh = await c.findOneAndUpdate({ _id: key }, { $set: { count: 1, expireAt: new Date(Date.now() + windowMs) } }, { upsert: true, returnDocument: 'after' });
    return fresh!.count as number;
  } catch {
    return ((await bump())?.count as number | undefined) ?? 1; // a concurrent request created the window first
  }
}

export async function peek(key: string): Promise<number> {
  const doc = await coll('authThrottle').findOne({ _id: key, expireAt: { $gt: new Date() } });
  return (doc?.count as number | undefined) ?? 0;
}

export const blockFor = (key: string, ms: number) =>
  coll('authThrottle').updateOne({ _id: `block:${key}` }, { $set: { count: 1, expireAt: new Date(Date.now() + ms) } }, { upsert: true });

/** Milliseconds left on a block, or 0. */
export async function blockedMs(key: string): Promise<number> {
  const doc = await coll('authThrottle').findOne({ _id: `block:${key}` });
  return doc ? Math.max(0, (doc.expireAt as Date).getTime() - Date.now()) : 0;
}

export const unblock = (key: string) => coll('authThrottle').deleteOne({ _id: `block:${key}` });
