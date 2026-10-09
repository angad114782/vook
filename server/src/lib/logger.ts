import pino from 'pino';
import { env } from '../config/env.ts';

// Never log credentials, tokens or personal data.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', '*.password', '*.passwordHash', '*.secret', '*.token'], censor: '[redacted]' },
});
