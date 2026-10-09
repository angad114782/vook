import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { closeDb, connectDb } from './db/mongo.ts';
import { ensureIndexes } from './db/indexes.ts';
import { logger } from './lib/logger.ts';
import { seedIfEmpty } from './seed/seed.ts';
import { initRealtime, closeRealtime } from './realtime/gateway.ts';
import { deliverQueuedMail } from './workers/mail.ts';
import { runBillingTick } from './domain/billing.ts';

async function main() {
  await connectDb(env.MONGODB_URI, env.MONGODB_DB);
  await ensureIndexes();
  if (env.SEED_DEMO) await seedIfEmpty();
  const app = createApp();
  const server = createServer(app);
  initRealtime(server);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 60_000;
  void runBillingTick().catch((err) => logger.error({ err }, 'billing tick failed'));
  setInterval(() => void runBillingTick().catch((err) => logger.error({ err }, 'billing tick failed')), 3_600_000).unref();
  setInterval(() => void deliverQueuedMail().catch((err) => logger.error({ err }, 'mail worker failed')), 15_000).unref();
  server.listen(env.PORT, () => logger.info(`Vook API listening on http://localhost:${env.PORT}/api/v2`));

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => { await closeRealtime(); await closeDb(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => { console.error('Failed to start:', err instanceof Error ? err.message : err); process.exit(1); });
