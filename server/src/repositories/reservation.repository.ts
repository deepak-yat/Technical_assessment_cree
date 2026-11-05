import { ClientSession, FilterQuery, Types } from 'mongoose';
import {
  Reservation,
  IReservationDocument,
  ReservationResponseDto,
} from '../models/reservation.model.js';
import {
  ReservationStatus,
  ReservationStatuses,
} from '../common/state/reservation-state-machine.js';
import { ApiPaginationMeta } from '../common/utils/api-response.js';

export interface CreateReservationRepoData {
  reference: string;
  guest: Types.ObjectId;
  roomType: Types.ObjectId;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomCount: number;
  priceSnapshot: number;
  totalAmount: number;
  status: typeof ReservationStatuses.CONFIRMED;
  idempotencyKey?: string | null;
  statusHistory: {
    fromStatus: null;
    toStatus: typeof ReservationStatuses.CONFIRMED;
    changedAt: Date;
    reason?: string;
    changedBy?: Types.ObjectId;
  }[];
}

export interface PaginatedReservationResult {
  data: ReservationResponseDto[];
  meta: ApiPaginationMeta;
}

export interface StaffReservationItem extends ReservationResponseDto {
  guestDetails?: {
    name: string;
    email: string;
  };
  roomTypeName?: string;
}

export interface PaginatedStaffReservationResult {
  data: StaffReservationItem[];
  meta: ApiPaginationMeta;
}

export interface DashboardSummaryData {
  arrivalsToday: number;
  departuresToday: number;
  occupiedRooms: number;
  pendingReservations: number;
}

export class ReservationRepository {
  async findById(id: string, session?: ClientSession): Promise<IReservationDocument | null> {
    const query = Reservation.findById(id);
    if (session) query.session(session);
    return query.exec();
  }

  async findByReference(reference: string): Promise<IReservationDocument | null> {
    return Reservation.findOne({ reference: reference.toUpperCase().trim() }).exec();
  }

  async findByIdempotencyKey(
    guestId: string,
    idempotencyKey: string,
  ): Promise<IReservationDocument | null> {
    return Reservation.findOne({
      guest: new Types.ObjectId(guestId),
      idempotencyKey: idempotencyKey.trim(),
    }).exec();
  }

  async create(
    data: CreateReservationRepoData,
    session?: ClientSession,
  ): Promise<IReservationDocument> {
    const [reservation] = await Reservation.create([data], { session });
    if (!reservation) {
      throw new Error('Failed to create reservation in repository');
    }
    return reservation;
  }

  async listByGuest(guestId: string, page = 1, limit = 10): Promise<PaginatedReservationResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const filter = { guest: new Types.ObjectId(guestId) };

    const [total, docs] = await Promise.all([
      Reservation.countDocuments(filter).exec(),
      Reservation.find(filter)
        .sort({ createdAt: -1, _id: -1 }) // Stable sort: createdAt desc + _id desc
        .skip(skip)
        .limit(safeLimit)
        .exec(),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      data: docs.map((doc) => doc.toDto()),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  async listAll(
    filter: FilterQuery<IReservationDocument>,
    page = 1,
    limit = 10,
  ): Promise<PaginatedReservationResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [total, docs] = await Promise.all([
      Reservation.countDocuments(filter).exec(),
      Reservation.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(safeLimit).exec(),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      data: docs.map((doc) => doc.toDto()),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Status-conditional atomic transition to CANCELLED.
   * Guarantees EXACTLY-ONCE execution: matches and updates ONLY if current status is PENDING or CONFIRMED.
   * If already CANCELLED or CHECKED_IN, matches 0 documents and returns null.
   */
  async atomicConditionalCancel(
    id: string,
    reason: string,
    changedBy: string,
    session?: ClientSession,
  ): Promise<IReservationDocument | null> {
    const query = Reservation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        status: { $in: [ReservationStatuses.PENDING, ReservationStatuses.CONFIRMED] },
      },
      {
        $set: { status: ReservationStatuses.CANCELLED },
        $push: {
          statusHistory: {
            fromStatus: ReservationStatuses.CONFIRMED,
            toStatus: ReservationStatuses.CANCELLED,
            changedAt: new Date(),
            reason,
            changedBy: new Types.ObjectId(changedBy),
          },
        },
      },
      { new: true, session },
    );

    return query.exec();
  }

  /**
   * Status-conditional front-desk check-in.
   * Transitions from CONFIRMED -> CHECKED_IN.
   */
  async atomicConditionalCheckIn(
    id: string,
    staffId: string,
  ): Promise<IReservationDocument | null> {
    return Reservation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        status: ReservationStatuses.CONFIRMED,
      },
      {
        $set: { status: ReservationStatuses.CHECKED_IN },
        $push: {
          statusHistory: {
            fromStatus: ReservationStatuses.CONFIRMED,
            toStatus: ReservationStatuses.CHECKED_IN,
            changedAt: new Date(),
            reason: 'Front desk guest check-in',
            changedBy: new Types.ObjectId(staffId),
          },
        },
      },
      { new: true },
    ).exec();
  }

  /**
   * Status-conditional front-desk check-out.
   * Transitions from CHECKED_IN -> CHECKED_OUT.
   * Guarantees exactly-once execution: matches ONLY if current status is CHECKED_IN.
   */
  async atomicConditionalCheckOut(
    id: string,
    staffId: string,
    session?: ClientSession,
  ): Promise<IReservationDocument | null> {
    return Reservation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        status: ReservationStatuses.CHECKED_IN,
      },
      {
        $set: { status: ReservationStatuses.CHECKED_OUT },
        $push: {
          statusHistory: {
            fromStatus: ReservationStatuses.CHECKED_IN,
            toStatus: ReservationStatuses.CHECKED_OUT,
            changedAt: new Date(),
            reason: 'Front desk guest check-out',
            changedBy: new Types.ObjectId(staffId),
          },
        },
      },
      { new: true, session },
    ).exec();
  }

  /**
   * Updates status with explicit state-machine validation and history audit log.
   */
  async updateStatusWithHistory(
    id: string,
    fromStatus: ReservationStatus,
    toStatus: ReservationStatus,
    reason: string,
    staffId: string,
    session?: ClientSession,
  ): Promise<IReservationDocument | null> {
    return Reservation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        status: fromStatus,
      },
      {
        $set: { status: toStatus },
        $push: {
          statusHistory: {
            fromStatus,
            toStatus,
            changedAt: new Date(),
            reason,
            changedBy: new Types.ObjectId(staffId),
          },
        },
      },
      { new: true, session },
    ).exec();
  }

  /**
   * Calculates dashboard summary counts for front-desk operations today.
   */
  async getDashboardCounts(today: string): Promise<DashboardSummaryData> {
    const [arrivalsToday, departuresToday, occupiedResult, pendingReservations] = await Promise.all(
      [
        Reservation.countDocuments({
          status: ReservationStatuses.CONFIRMED,
          checkIn: today,
        }).exec(),
        Reservation.countDocuments({
          status: ReservationStatuses.CHECKED_IN,
          checkOut: today,
        }).exec(),
        Reservation.aggregate<{ totalOccupied: number }>([
          { $match: { status: ReservationStatuses.CHECKED_IN } },
          { $group: { _id: null, totalOccupied: { $sum: '$roomCount' } } },
        ]).exec(),
        Reservation.countDocuments({
          status: ReservationStatuses.PENDING,
        }).exec(),
      ],
    );

    const occupiedRooms = occupiedResult[0]?.totalOccupied ?? 0;

    return {
      arrivalsToday,
      departuresToday,
      occupiedRooms,
      pendingReservations,
    };
  }

  /**
   * Staff listing with server-side pagination, filters, sorting, and user/room population.
   */
  async listStaffReservations(
    filter: FilterQuery<IReservationDocument>,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<PaginatedStaffReservationResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const sortDir: 1 | -1 = sortOrder === 'asc' ? 1 : -1;

    const sortOption: Record<string, 1 | -1> = {
      [sortBy]: sortDir,
      _id: -1, // Stable secondary sort
    };

    const [total, docs] = await Promise.all([
      Reservation.countDocuments(filter).exec(),
      Reservation.find(filter)
        .populate<{ guest: { name: string; email: string } }>('guest', 'name email')
        .populate<{ roomType: { name: string } }>('roomType', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(safeLimit)
        .exec(),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

    const data: StaffReservationItem[] = docs.map((doc) => {
      const dto = doc.toDto();
      const guestObj = doc.guest as unknown as { name?: string; email?: string } | undefined;
      const roomObj = doc.roomType as unknown as { name?: string } | undefined;

      return {
        ...dto,
        guestDetails: guestObj
          ? {
              name: guestObj.name || '',
              email: guestObj.email || '',
            }
          : undefined,
        roomTypeName: roomObj?.name,
      };
    });

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }
}

export const reservationRepository = new ReservationRepository();
