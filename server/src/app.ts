import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.ts';
import { pingDb } from './db/mongo.ts';
import { AppError } from './lib/errors.ts';
import { logger } from './lib/logger.ts';
import { errorHandler, notFoundHandler } from './middleware/errors.ts';
import { gate } from './middleware/gate.ts';
import { csrfGuard, loadSession, requestContext, requireAuth } from './middleware/session.ts';
import { authRouter } from './modules/auth/routes.ts';
import { publicBillingRouter } from './modules/platform/billing.ts';
import { publicDeviceRouter } from './modules/platform/attendanceDevices.ts';
import { maintenanceGate } from './middleware/maintenance.ts';
import { apiRouter } from './modules/index.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestContext);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as express.Request).ctx?.requestId, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { if (req.url?.includes('/webhooks/')) (req as unknown as { rawBody: Buffer }).rawBody = buf; } }));

  // Health endpoints stay outside the rate limit and auth so load balancers can always probe them.
  app.get('/health', (_req, res) => void res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try { await pingDb(); res.json({ status: 'ready' }); } catch { res.status(503).json({ status: 'unavailable' }); }
  });

  // Per-user (or per-IP when anonymous) ceiling; overload answers politely instead of falling over.
  const limiter = rateLimit({
    windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => (req.cookies?.vook_sid ? `s:${String(req.cookies.vook_sid).slice(0, 16)}` : `ip:${ipKeyGenerator(req.ip ?? '')}`),
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'You are doing that too fast. Please wait a moment and try again.')),
  });

  const v2 = Router();
  v2.use(limiter, loadSession);
  v2.use(publicBillingRouter, publicDeviceRouter);
  v2.use(csrfGuard);
  v2.use(authRouter);
  v2.use(maintenanceGate);
  v2.use(apiRouter(requireAuth, gate));
  app.use('/api/v2', v2);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
