import type { Request, Response } from 'express';
import { coll } from '../db/mongo.ts';
import { me } from './http.ts';

/**
 * Retry-safe mutations: the same Idempotency-Key from the same user returns the original response instead of repeating the work.
 * Keys expire after 24h (TTL index).
 */
export async function idempotent(req: Request, res: Response, run: () => Promise<{ status: number; body: unknown }>) {
  const key = req.headers['idempotency-key'];
  const user = me(req);
  if (typeof key !== 'string' || key.length < 8 || key.length > 120) {
    const result = await run();
    return void res.status(result.status).json(result.body);
  }
  const _id = `${user.id}:${key}`;
  const existing = await coll('idempotency').findOne({ _id });
  if (existing?.response) return void res.status(existing.response.status).setHeader('Idempotent-Replay', 'true').json(existing.response.body);
  try {
    await coll('idempotency').insertOne({ _id, key, userId: user.id, createdAt: new Date() });
  } catch {
    // A concurrent request with the same key is in flight: let the client retry shortly.
    return void res.status(409).json({ error: { code: 'REQUEST_IN_PROGRESS', message: 'This is already being processed. Please wait a moment.', requestId: req.ctx.requestId } });
  }
  try {
    const result = await run();
    await coll('idempotency').updateOne({ _id }, { $set: { response: result } });
    res.status(result.status).json(result.body);
  } catch (err) {
    await coll('idempotency').deleteOne({ _id });
    throw err;
  }
}
