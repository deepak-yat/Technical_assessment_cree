import { Types } from 'mongoose';
import {
  ReservationRepository,
  reservationRepository,
  PaginatedReservationResult,
} from '../repositories/reservation.repository.js';
import { RoomTypeRepository, roomTypeRepository } from '../repositories/room-type.repository.js';
import { RoomInventory } from '../models/room-inventory.model.js';
import { CreateReservationInput, CancelReservationInput } from '../schemas/reservation.schema.js';
import { ReservationResponseDto } from '../models/reservation.model.js';
import { ReservationStatuses, isCancellable } from '../common/state/reservation-state-machine.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../common/errors/app-error.js';
import { ErrorCodes } from '../common/errors/error-codes.js';
import {
  calculateNights,
  getDateRangeArray,
  getTodayUtcString,
  validateStayDates,
} from '../common/utils/date.js';
import { calculateReservationPrice } from '../common/utils/pricing.js';
import { config } from '../config/env.js';
import { generateReservationReference } from '../common/utils/reference.js';
import { withTransactionRetry } from '../common/utils/transaction.js';
import { UserRole, UserRoles } from '../types/auth.types.js';

export class ReservationService {
  constructor(
    private readonly reservationRepo: ReservationRepository = reservationRepository,
    private readonly roomTypeRepo: RoomTypeRepository = roomTypeRepository,
  ) {}

  /**
   * Creates a new reservation inside an ACID transaction with per-night conditional updates.
   *
   * Concurrency & Consistency Guarantees:
   * 1. Idempotency Check: Returns existing reservation if (guest, idempotencyKey) matches.
   * 2. Price snapshot and total calculated strictly on server (client values ignored).
   * 3. Capacity verification: guestCount <= capacity * roomCount.
   * 4. Per-night atomic conditional increment: booked <= (capacity - roomCount).
   * 5. Any night failing aborts transaction -> 409 Conflict (no partial bookings).
   * 6. Transient transaction write conflicts automatically retried with jittered backoff.
   */
  async createReservation(
    guestId: string,
    input: CreateReservationInput,
    idempotencyKey?: string | null,
  ): Promise<{ reservation: ReservationResponseDto; isDuplicate: boolean }> {
    // 1. Validate stay dates & half-open interval
    validateStayDates(input.checkIn, input.checkOut);
    const nights = calculateNights(input.checkIn, input.checkOut);
    const dates = getDateRangeArray(input.checkIn, input.checkOut);

    // 2. Check Idempotency Key before proceeding
    if (idempotencyKey) {
      const existing = await this.reservationRepo.findByIdempotencyKey(guestId, idempotencyKey);
      if (existing) {
        return { reservation: existing.toDto(), isDuplicate: true };
      }
    }

    // 3. Retrieve RoomType to snapshot price and verify capacity
    const roomType = await this.roomTypeRepo.findById(input.roomTypeId);
    if (!roomType || !roomType.isActive) {
      throw new NotFoundError(
        `Room type with id '${input.roomTypeId}' was not found or is inactive`,
      );
    }

    // 4. Server-enforced capacity rule
    const totalCapacity = roomType.capacity * input.roomCount;
    if (input.guestCount > totalCapacity) {
      throw new BadRequestError(
        `Guest count (${input.guestCount}) exceeds total capacity of ${input.roomCount} room(s) (maximum ${totalCapacity} guests).`,
      );
    }

    // 5. Server-calculated price snapshot & total
    const priceSnapshot = roomType.pricePerNight;
    const totalAmount = calculateReservationPrice(priceSnapshot, nights, input.roomCount);

    // 6. Execute atomic booking inside MongoDB transaction with bounded retry
    let isDuplicate = false;

    try {
      const createdReservation = await withTransactionRetry(async (session) => {
        // Step 0: Check idempotency inside transaction to catch concurrent in-flight bookings
        if (idempotencyKey) {
          const existingInTx = await this.reservationRepo.findByIdempotencyKey(
            guestId,
            idempotencyKey,
          );
          if (existingInTx) {
            isDuplicate = true;
            return existingInTx;
          }
        }

        // Step A: Idempotent upsert to ensure RoomInventory documents exist for all stay dates
        for (const date of dates) {
          await RoomInventory.updateOne(
            {
              roomTypeId: roomType._id,
              date,
            },
            {
              $setOnInsert: {
                capacity: roomType.totalInventory,
                booked: 0,
              },
            },
            {
              upsert: true,
              session,
            },
          );
        }

        // Step B: Atomically increment booked count for each night with conditional guard
        // Guard condition: booked <= (capacity - roomCount)
        for (const date of dates) {
          const updatedInventory = await RoomInventory.findOneAndUpdate(
            {
              roomTypeId: roomType._id,
              date,
              booked: { $lte: roomType.totalInventory - input.roomCount },
            },
            {
              $inc: { booked: input.roomCount },
            },
            {
              session,
              new: true,
            },
          );

          if (!updatedInventory) {
            // Overbooking condition detected on this night!
            // Abort the entire transaction by throwing ConflictError
            throw new ConflictError(
              `Insufficient room inventory on date ${date}. Requested ${input.roomCount} room(s).`,
              { conflictDate: date, requestedRooms: input.roomCount },
              ErrorCodes.INSUFFICIENT_INVENTORY,
            );
          }
        }

        // Step C: Generate unique reference and persist the reservation
        const reference = generateReservationReference();
        const initialStatus = config.AUTO_CONFIRM
          ? ReservationStatuses.CONFIRMED
          : ReservationStatuses.PENDING;
        const initialReason = config.AUTO_CONFIRM
          ? 'Reservation booked and auto-confirmed'
          : 'Reservation created in PENDING status awaiting staff confirmation';

        const reservationDoc = await this.reservationRepo.create(
          {
            reference,
            guest: new Types.ObjectId(guestId),
            roomType: roomType._id,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            guestCount: input.guestCount,
            roomCount: input.roomCount,
            priceSnapshot,
            totalAmount,
            status: initialStatus,
            idempotencyKey: idempotencyKey || null,
            statusHistory: [
              {
                fromStatus: null,
                toStatus: initialStatus,
                changedAt: new Date(),
                reason: initialReason,
                changedBy: new Types.ObjectId(guestId),
              },
            ],
          },
          session,
        );

        return reservationDoc;
      });

      return { reservation: createdReservation.toDto(), isDuplicate };
    } catch (err: unknown) {
      // If idempotency collision occurred and escaped retry bounds, return the winning reservation
      if (
        idempotencyKey &&
        err &&
        typeof err === 'object' &&
        ((err as { code?: number }).code === 11000 ||
          (err as Error).message?.includes('E11000') ||
          (err as Error).message?.includes('idempotencyKey'))
      ) {
        const existing = await this.reservationRepo.findByIdempotencyKey(guestId, idempotencyKey);
        if (existing) {
          return { reservation: existing.toDto(), isDuplicate: true };
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves a single reservation. Enforces guest ownership check.
   */
  async getReservation(
    id: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepo.findById(id);
    if (!reservation) {
      throw new NotFoundError(`Reservation with id '${id}' not found`);
    }

    // Guest role can ONLY access their own reservations
    if (currentUserRole === UserRoles.GUEST && reservation.guest.toString() !== currentUserId) {
      throw new ForbiddenError('You do not have permission to view this reservation');
    }

    return reservation.toDto();
  }

  /**
   * Lists reservations belonging to the authenticated guest with pagination.
   */
  async listGuestReservations(
    guestId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedReservationResult> {
    return this.reservationRepo.listByGuest(guestId, page, limit);
  }

  /**
   * Cancels a reservation with exactly-once inventory release semantics.
   */
  async cancelReservation(
    id: string,
    currentUserId: string,
    currentUserRole: UserRole,
    input?: CancelReservationInput,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepo.findById(id);
    if (!reservation) {
      throw new NotFoundError(`Reservation with id '${id}' not found`);
    }

    // Guest ownership check
    if (currentUserRole === UserRoles.GUEST && reservation.guest.toString() !== currentUserId) {
      throw new ForbiddenError('You do not have permission to cancel this reservation');
    }

    // Business rule: Only PENDING or CONFIRMED reservations can be cancelled
    if (!isCancellable(reservation.status)) {
      throw new ConflictError(
        `Cannot cancel reservation with status '${reservation.status}'. Only PENDING or CONFIRMED reservations can be cancelled.`,
        { status: reservation.status },
        ErrorCodes.INVALID_STATE_TRANSITION,
      );
    }

    // Business rule: Guests cannot cancel after check-in date has passed
    const today = getTodayUtcString();
    if (currentUserRole === UserRoles.GUEST && today >= reservation.checkIn) {
      throw new ConflictError(
        `Reservations cannot be cancelled on or after the check-in date (${reservation.checkIn}).`,
        { checkIn: reservation.checkIn, today },
      );
    }

    // Execute atomic conditional status update & inventory release inside transaction
    const cancelledDoc = await withTransactionRetry(async (session) => {
      // Step 1: Status-conditional atomic transition to CANCELLED
      // If already cancelled by a racing request, returns null!
      const updated = await this.reservationRepo.atomicConditionalCancel(
        id,
        input?.reason || 'Cancelled by guest',
        currentUserId,
        session,
      );

      if (!updated) {
        throw new ConflictError(
          'Reservation was already cancelled or its status has changed',
          undefined,
          ErrorCodes.INVALID_STATE_TRANSITION,
        );
      }

      // Step 2: Exactly-once inventory release: decrement booked count for each night
      const dates = getDateRangeArray(updated.checkIn, updated.checkOut);
      for (const date of dates) {
        await RoomInventory.updateOne(
          {
            roomTypeId: updated.roomType,
            date,
          },
          {
            $inc: { booked: -updated.roomCount },
          },
          { session },
        );
      }

      return updated;
    });

    return cancelledDoc.toDto();
  }
}

export const reservationService = new ReservationService();
