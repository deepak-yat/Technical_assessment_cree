import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage): string => {
    const existingId = req.headers['x-request-id'];
    if (typeof existingId === 'string' && existingId.trim().length > 0) {
      return existingId;
    }
    return randomUUID();
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req: IncomingMessage, res: ServerResponse, error: Error) => {
    return `${req.method} ${req.url} failed with ${res.statusCode}: ${error.message}`;
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
    censor: '[REDACTED]',
  },
});
