import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { env } from '../config/env.ts';

/**
 * StorageProvider port. Today files live on local disk; an S3/GCS adapter can replace this file
 * without touching any route (same put/stream/remove contract).
 */
const root = () => resolve(env.UPLOAD_DIR);
const safePath = (key: string) => {
  const full = resolve(join(root(), key));
  if (!full.startsWith(root() + sep)) throw new Error('Invalid storage key');
  return full;
};

export const storage = {
  async put(key: string, data: Buffer) { const p = safePath(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, data); },
  stream(key: string) { return createReadStream(safePath(key)); },
  async remove(key: string) { await unlink(safePath(key)).catch(() => undefined); },
};
