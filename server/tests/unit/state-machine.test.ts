import { describe, it, expect } from 'vitest';
import {
  ReservationStatuses,
  canTransition,
  validateTransition,
  isCancellable,
} from '../../src/common/state/reservation-state-machine.js';
import { ConflictError } from '../../src/common/errors/app-error.js';

describe('Reservation State Machine', () => {
  it('should allow valid forward lifecycle transitions', () => {
    expect(canTransition(ReservationStatuses.PENDING, ReservationStatuses.CONFIRMED)).toBe(true);
    expect(canTransition(ReservationStatuses.CONFIRMED, ReservationStatuses.CHECKED_IN)).toBe(true);
    expect(canTransition(ReservationStatuses.CHECKED_IN, ReservationStatuses.CHECKED_OUT)).toBe(
      true,
    );
  });

  it('should allow cancellation from PENDING and CONFIRMED stages', () => {
    expect(isCancellable(ReservationStatuses.PENDING)).toBe(true);
    expect(isCancellable(ReservationStatuses.CONFIRMED)).toBe(true);

    expect(canTransition(ReservationStatuses.PENDING, ReservationStatuses.CANCELLED)).toBe(true);
    expect(canTransition(ReservationStatuses.CONFIRMED, ReservationStatuses.CANCELLED)).toBe(true);
  });

  it('should REJECT cancellation after guest has checked in', () => {
    expect(isCancellable(ReservationStatuses.CHECKED_IN)).toBe(false);
    expect(canTransition(ReservationStatuses.CHECKED_IN, ReservationStatuses.CANCELLED)).toBe(
      false,
    );

    expect(() =>
      validateTransition(ReservationStatuses.CHECKED_IN, ReservationStatuses.CANCELLED),
    ).toThrow(ConflictError);
  });

  it('should REJECT transitions out of terminal states (CHECKED_OUT, CANCELLED)', () => {
    expect(canTransition(ReservationStatuses.CHECKED_OUT, ReservationStatuses.CHECKED_IN)).toBe(
      false,
    );
    expect(canTransition(ReservationStatuses.CANCELLED, ReservationStatuses.CONFIRMED)).toBe(false);

    expect(() =>
      validateTransition(ReservationStatuses.CANCELLED, ReservationStatuses.CONFIRMED),
    ).toThrow(ConflictError);
  });

  it('should REJECT skipping lifecycle steps (e.g. PENDING straight to CHECKED_OUT)', () => {
    expect(canTransition(ReservationStatuses.PENDING, ReservationStatuses.CHECKED_OUT)).toBe(false);
    expect(() =>
      validateTransition(ReservationStatuses.PENDING, ReservationStatuses.CHECKED_OUT),
    ).toThrow(ConflictError);
  });
});
