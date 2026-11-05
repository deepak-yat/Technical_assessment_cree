import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger.js';
import { AppError } from '../errors/app-error.js';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

/**
 * Executes an operation inside a MongoDB transaction with bounded jittered retry
 * for transient errors (e.g. WriteConflict, TransientTransactionError).
 *
 * Does NOT retry deterministic operational errors (e.g. InsufficientInventory, ValidationError).
 */
export async function withTransactionRetry<T>(
  operation: (session: ClientSession) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;

  let attempt = 0;

  while (attempt <= maxRetries) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      const result = await operation(session);

      await session.commitTransaction();
      return result;
    } catch (error: unknown) {
      // Always abort transaction on error
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          logger.warn({ abortErr }, 'Error aborting transaction');
        }
      }

      // Do not retry deterministic domain/operational errors (e.g. 409 Insufficient Inventory)
      if (error instanceof AppError && error.isOperational) {
        throw error;
      }

      // Check if MongoDB tagged error as TransientTransactionError
      const isTransient =
        error &&
        typeof error === 'object' &&
        'hasErrorLabel' in error &&
        typeof (error as { hasErrorLabel: unknown }).hasErrorLabel === 'function' &&
        (error as { hasErrorLabel: (label: string) => boolean }).hasErrorLabel(
          'TransientTransactionError',
        );

      const isWriteConflict =
        error instanceof Error &&
        (error.message.includes('WriteConflict') || (error as { code?: number }).code === 112);

      // Handle MongoDB E11000 duplicate key errors during concurrent upserts (e.g. initial RoomInventory creation)
      const isDuplicateKey =
        error &&
        typeof error === 'object' &&
        ((error as { code?: number }).code === 11000 ||
          (error as { codeName?: string }).codeName === 'DuplicateKey' ||
          (error instanceof Error && error.message.includes('E11000')));

      attempt++;

      const isRetryable = isTransient || isWriteConflict || isDuplicateKey;

      if (isRetryable && attempt <= maxRetries) {
        // Bounded jittered backoff: delay = baseDelay * 2^(attempt-1) + jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * baseDelayMs;
        const totalDelay = Math.round(exponentialDelay + jitter);

        logger.warn(
          { attempt, maxRetries, totalDelay, errMsg: (error as Error).message },
          'Transient transaction error or collision encountered, retrying with jittered backoff...',
        );

        await new Promise((resolve) => setTimeout(resolve, totalDelay));
        continue;
      }

      // If non-transient or exhausted all retries, throw original error
      throw error;
    } finally {
      await session.endSession();
    }
  }

  throw new Error('Transaction exceeded maximum retry bounds');
}
