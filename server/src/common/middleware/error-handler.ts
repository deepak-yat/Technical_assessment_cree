import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';
import { sendError } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';
import { config } from '../../config/env.js';

interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies 4-argument functions as error handlers
  _next: NextFunction,
): void {
  const reqId = req.id || req.headers['x-request-id'] || 'unknown';

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ reqId, err }, `Non-operational AppError: ${err.message}`);
    }
    sendError(res, err.statusCode, err.errorCode, err.message, err.details);
    return;
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    sendError(res, 422, ErrorCodes.VALIDATION_ERROR, 'Validation failed', formattedIssues);
    return;
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId in params)
  if (err instanceof mongoose.Error.CastError) {
    sendError(
      res,
      400,
      ErrorCodes.BAD_REQUEST,
      `Invalid value '${String(err.value)}' for field '${err.path}'`,
    );
    return;
  }

  // 4. Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    sendError(res, 422, ErrorCodes.VALIDATION_ERROR, 'Database validation failed', details);
    return;
  }

  // 5. MongoDB Duplicate Key (E11000)
  const mongoErr = err as MongoError;
  if (mongoErr && mongoErr.code === 11000) {
    const duplicateFields = mongoErr.keyValue ? Object.keys(mongoErr.keyValue) : ['resource'];
    sendError(
      res,
      409,
      ErrorCodes.CONFLICT,
      `Duplicate entry for: ${duplicateFields.join(', ')}`,
      mongoErr.keyValue,
    );
    return;
  }

  // 6. JSON Syntax Error (Malformed JSON payload from client)
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: unknown }).status === 400 &&
    'body' in err
  ) {
    sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Malformed JSON payload in request body');
    return;
  }

  // 7. Unknown / Unhandled System Errors (500)
  logger.error(
    {
      reqId,
      err,
      method: req.method,
      url: req.originalUrl,
      body: req.body,
    },
    'Unhandled server exception',
  );

  const message =
    config.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err as Error).message || 'Internal server error';

  const details =
    config.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : undefined;

  sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, message, details);
}
