import { ErrorCode, ErrorCodes } from './error-codes.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, ErrorCodes.BAD_REQUEST, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, ErrorCodes.VALIDATION_ERROR, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, ErrorCodes.UNAUTHORIZED, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(message, 403, ErrorCodes.FORBIDDEN, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, ErrorCodes.NOT_FOUND, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict',
    details?: unknown,
    errorCode: ErrorCode = ErrorCodes.CONFLICT,
  ) {
    super(message, 409, errorCode, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later', details?: unknown) {
    super(message, 429, ErrorCodes.TOO_MANY_REQUESTS, details);
  }
}
