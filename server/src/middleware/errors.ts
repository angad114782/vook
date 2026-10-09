import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors.ts';
import { logger } from '../lib/logger.ts';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.', requestId: req.ctx?.requestId } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.ctx?.requestId;
  if (err instanceof AppError) {
    return void res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId } });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return void res.status(tooBig ? 413 : 422).json({ error: { code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED', message: tooBig ? 'That file is too big.' : 'The upload could not be read.', requestId } });
  }
  if (err?.type === 'entity.too.large') return void res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'That request is too large.', requestId } });
  if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request could not be read.', requestId } });
  if (err?.code === 11000) return void res.status(409).json({ error: { code: 'DUPLICATE', message: 'This already exists.', requestId } });
  logger.error({ err, requestId, path: req.path }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.', requestId } });
};
