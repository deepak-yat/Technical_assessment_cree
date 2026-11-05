import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../../config/env.js';
import { sendError } from '../utils/api-response.js';
import { ErrorCodes } from '../errors/error-codes.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts per 15 min in prod/dev, relaxed in tests
  standardHeaders: true, // Draft-6 RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (_req: Request, res: Response) => {
    return sendError(
      res,
      429,
      ErrorCodes.TOO_MANY_REQUESTS,
      'Too many authentication attempts. Please try again after 15 minutes.',
      { retryAfterMs: 15 * 60 * 1000 },
    );
  },
});
