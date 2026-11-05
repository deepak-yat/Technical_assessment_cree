import { ConflictError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';

export const ReservationStatuses = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
} as const;

export type ReservationStatus = (typeof ReservationStatuses)[keyof typeof ReservationStatuses];

/**
 * Strict state transition matrix.
 * Defines allowed destination states for each current state.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<ReservationStatus, readonly ReservationStatus[]>
> = {
  [ReservationStatuses.PENDING]: [ReservationStatuses.CONFIRMED, ReservationStatuses.CANCELLED],
  [ReservationStatuses.CONFIRMED]: [ReservationStatuses.CHECKED_IN, ReservationStatuses.CANCELLED],
  [ReservationStatuses.CHECKED_IN]: [ReservationStatuses.CHECKED_OUT],
  [ReservationStatuses.CHECKED_OUT]: [], // Terminal state
  [ReservationStatuses.CANCELLED]: [], // Terminal state
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

export function validateTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `Cannot transition reservation status from '${from}' to '${to}'. Allowed next states: [${(
        ALLOWED_TRANSITIONS[from] || []
      ).join(', ')}]`,
      { currentStatus: from, targetStatus: to },
      ErrorCodes.INVALID_STATE_TRANSITION,
    );
  }
}

export function isCancellable(status: ReservationStatus): boolean {
  return status === ReservationStatuses.PENDING || status === ReservationStatuses.CONFIRMED;
}
