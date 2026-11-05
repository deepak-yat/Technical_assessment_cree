import {
  ReservationRepository,
  reservationRepository,
  PaginatedStaffReservationResult,
} from '../repositories/reservation.repository.js';
import { RoomType } from '../models/room-type.model.js';
import { RoomInventory } from '../models/room-inventory.model.js';
import { User } from '../models/user.model.js';
import { StaffReservationQuery, UpdateReservationStatusInput } from '../schemas/staff.schema.js';
import {
  ReservationStatuses,
  validateTransition,
  ReservationStatus,
} from '../common/state/reservation-state-machine.js';
import { ConflictError, NotFoundError } from '../common/errors/app-error.js';
import { ErrorCodes } from '../common/errors/error-codes.js';
import { getDateRangeArray, getTodayUtcString } from '../common/utils/date.js';
import { withTransactionRetry } from '../common/utils/transaction.js';
import { ReservationResponseDto } from '../models/reservation.model.js';
import { reservationService } from './reservation.service.js';
import { UserRoles } from '../types/auth.types.js';
import { FilterQuery } from 'mongoose';
import { IReservationDocument } from '../models/reservation.model.js';

export interface DashboardSummaryResponse {
  today: string;
  arrivalsToday: number;
  departuresToday: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  pendingReservations: number;
}

export class StaffService {
  constructor(private readonly reservationRepo: ReservationRepository = reservationRepository) {}

  /**
   * Generates real-time front-desk dashboard KPIs.
   */
  async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    const today = getTodayUtcString();

    const [counts, roomStats] = await Promise.all([
      this.reservationRepo.getDashboardCounts(today),
      RoomType.aggregate<{ totalInventorySum: number }>([
        { $match: { isActive: true } },
        { $group: { _id: null, totalInventorySum: { $sum: '$totalInventory' } } },
      ]).exec(),
    ]);

    const totalRooms = roomStats[0]?.totalInventorySum ?? 0;
    const occupancyRate =
      totalRooms > 0 ? Math.round((counts.occupiedRooms / totalRooms) * 1000) / 10 : 0;

    return {
      today,
      arrivalsToday: counts.arrivalsToday,
      departuresToday: counts.departuresToday,
      occupiedRooms: counts.occupiedRooms,
      totalRooms,
      occupancyRate,
      pendingReservations: counts.pendingReservations,
    };
  }

  /**
   * Search and filter all hotel reservations with server-side pagination.
   */
  async listReservations(query: StaffReservationQuery): Promise<PaginatedStaffReservationResult> {
    const filter: FilterQuery<IReservationDocument> = {};

    // 1. Status Filter
    if (query.status) {
      filter.status = query.status;
    }

    // 2. Date Range Filters on checkIn
    if (query.checkInFrom || query.checkInTo) {
      filter.checkIn = {};
      if (query.checkInFrom) filter.checkIn.$gte = query.checkInFrom;
      if (query.checkInTo) filter.checkIn.$lte = query.checkInTo;
    }

    // 3. Search Filter: by Reference OR Guest Name/Email
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');

      // Find guests matching search string
      const matchedUsers = await User.find({
        $or: [{ email: searchRegex }, { name: searchRegex }],
      })
        .select('_id')
        .exec();

      const matchedUserIds = matchedUsers.map((u) => u._id);

      filter.$or = [{ reference: searchRegex }, { guest: { $in: matchedUserIds } }];
    }

    return this.reservationRepo.listStaffReservations(
      filter,
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder,
    );
  }

  /**
   * Front-desk guest check-in.
   * Enforces: status is CONFIRMED, today >= checkIn date.
   */
  async checkIn(reservationId: string, staffId: string): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation with id '${reservationId}' not found`);
    }

    // State machine transition validation
    validateTransition(reservation.status, ReservationStatuses.CHECKED_IN);

    // Business rule: Guest cannot check in prior to scheduled check-in date
    const today = getTodayUtcString();
    if (today < reservation.checkIn) {
      throw new ConflictError(
        `Cannot check in guest prior to the scheduled check-in date (${reservation.checkIn}). Today is ${today}.`,
        { checkIn: reservation.checkIn, today },
      );
    }

    const updated = await this.reservationRepo.atomicConditionalCheckIn(reservationId, staffId);

    if (!updated) {
      throw new ConflictError(
        'Failed to check in reservation. Reservation status may have been modified concurrently.',
        undefined,
        ErrorCodes.INVALID_STATE_TRANSITION,
      );
    }

    return updated.toDto();
  }

  /**
   * Front-desk guest check-out with exactly-once inventory release.
   */
  async checkOut(reservationId: string, staffId: string): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation with id '${reservationId}' not found`);
    }

    // State machine transition validation
    validateTransition(reservation.status, ReservationStatuses.CHECKED_OUT);

    const checkedOutDoc = await withTransactionRetry(async (session) => {
      // Step 1: Status-conditional transition to CHECKED_OUT
      // Matches and updates ONLY if current status is CHECKED_IN
      const updated = await this.reservationRepo.atomicConditionalCheckOut(
        reservationId,
        staffId,
        session,
      );

      if (!updated) {
        throw new ConflictError(
          'Failed to check out reservation. Reservation may not be in CHECKED_IN status or was already checked out.',
          undefined,
          ErrorCodes.INVALID_STATE_TRANSITION,
        );
      }

      // Step 2: Exactly-once inventory release: decrement booked count for each stay night
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

    return checkedOutDoc.toDto();
  }

  /**
   * Generalized staff status update endpoint using the strict transition state machine.
   */
  async updateStatus(
    reservationId: string,
    input: UpdateReservationStatusInput,
    staffId: string,
  ): Promise<ReservationResponseDto> {
    const targetStatus = input.status as ReservationStatus;

    if (targetStatus === ReservationStatuses.CHECKED_IN) {
      return this.checkIn(reservationId, staffId);
    }

    if (targetStatus === ReservationStatuses.CHECKED_OUT) {
      return this.checkOut(reservationId, staffId);
    }

    if (targetStatus === ReservationStatuses.CANCELLED) {
      return reservationService.cancelReservation(reservationId, staffId, UserRoles.STAFF, {
        reason: input.reason,
      });
    }

    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation with id '${reservationId}' not found`);
    }

    validateTransition(reservation.status, targetStatus);

    const updated = await this.reservationRepo.updateStatusWithHistory(
      reservationId,
      reservation.status,
      targetStatus,
      input.reason || 'Staff status update',
      staffId,
    );

    if (!updated) {
      throw new ConflictError(
        'Failed to update reservation status. Document may have changed concurrently.',
        undefined,
        ErrorCodes.INVALID_STATE_TRANSITION,
      );
    }

    return updated.toDto();
  }
}

export const staffService = new StaffService();
