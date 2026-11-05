import {
  RoomTypeRepository,
  roomTypeRepository,
  PaginatedResult,
} from '../repositories/room-type.repository.js';
import {
  RoomInventoryRepository,
  roomInventoryRepository,
} from '../repositories/room-inventory.repository.js';
import {
  CreateRoomTypeInput,
  UpdateRoomTypeInput,
  ListRoomTypesQuery,
  AvailabilitySearchQuery,
} from '../schemas/room-type.schema.js';
import { RoomType, IRoomTypeDocument, RoomTypeResponseDto } from '../models/room-type.model.js';
import { ConflictError, NotFoundError } from '../common/errors/app-error.js';
import { getDateRangeArray, getTodayUtcString, validateStayDates } from '../common/utils/date.js';
import { PipelineStage } from 'mongoose';

export interface RoomAvailabilityResult {
  roomType: RoomTypeResponseDto;
  nightsCount: number;
  availableRooms: number;
  pricePerNight: number;
  totalPrice: number;
  isAvailable: boolean;
}

export class RoomTypeService {
  constructor(
    private readonly roomTypeRepo: RoomTypeRepository = roomTypeRepository,
    private readonly inventoryRepo: RoomInventoryRepository = roomInventoryRepository,
  ) {}

  async create(input: CreateRoomTypeInput): Promise<RoomTypeResponseDto> {
    const existing = await this.roomTypeRepo.findByName(input.name);
    if (existing) {
      throw new ConflictError(`A room type named '${input.name}' already exists`);
    }

    const doc = await this.roomTypeRepo.create(input);
    return doc.toDto();
  }

  async getById(id: string): Promise<RoomTypeResponseDto> {
    const doc = await this.roomTypeRepo.findById(id);
    if (!doc) {
      throw new NotFoundError(`Room type with id '${id}' not found`);
    }
    return doc.toDto();
  }

  async list(
    query: ListRoomTypesQuery,
    publicOnly = false,
  ): Promise<PaginatedResult<RoomTypeResponseDto>> {
    const filter: Record<string, unknown> = {};

    if (publicOnly) {
      filter.isActive = true;
    } else if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const result = await this.roomTypeRepo.listPaginated(filter, query.page, query.limit);

    return {
      data: result.data.map((doc) => doc.toDto()),
      meta: result.meta,
    };
  }

  async update(id: string, input: UpdateRoomTypeInput): Promise<RoomTypeResponseDto> {
    const existing = await this.roomTypeRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Room type with id '${id}' not found`);
    }

    // Check name uniqueness if updated
    if (input.name && input.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await this.roomTypeRepo.findByName(input.name);
      if (nameConflict) {
        throw new ConflictError(`A room type named '${input.name}' already exists`);
      }
    }

    // BUSINESS RULE: Reject lowering totalInventory below already-booked nights in the future
    if (input.totalInventory !== undefined && input.totalInventory < existing.totalInventory) {
      const today = getTodayUtcString();
      const overbooked = await this.inventoryRepo.findFutureOverbookedRecord(
        id,
        today,
        input.totalInventory,
      );

      if (overbooked) {
        throw new ConflictError(
          `Cannot reduce total inventory to ${input.totalInventory}. Date ${overbooked.date} already has ${overbooked.booked} room(s) booked.`,
          {
            conflictDate: overbooked.date,
            bookedRooms: overbooked.booked,
            attemptedCapacity: input.totalInventory,
          },
        );
      }

      // Safe to sync future inventory capacities
      await this.inventoryRepo.syncFutureCapacities(id, today, input.totalInventory);
    }

    const updated = await this.roomTypeRepo.update(id, input);
    if (!updated) {
      throw new NotFoundError(`Room type with id '${id}' not found`);
    }

    return updated.toDto();
  }

  async setStatus(id: string, isActive: boolean): Promise<RoomTypeResponseDto> {
    const doc = await this.roomTypeRepo.update(id, { isActive });
    if (!doc) {
      throw new NotFoundError(`Room type with id '${id}' not found`);
    }
    return doc.toDto();
  }

  async delete(id: string): Promise<void> {
    const existing = await this.roomTypeRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Room type with id '${id}' not found`);
    }

    const today = getTodayUtcString();
    const futureBookings = await this.inventoryRepo.findFutureOverbookedRecord(id, today, 0);
    if (futureBookings) {
      throw new ConflictError(
        `Cannot delete room type with existing future bookings. Deactivate it instead.`,
      );
    }

    await this.roomTypeRepo.delete(id);
  }

  /**
   * Search availability across RoomInventory for a date range [checkIn, checkOut).
   *
   * Correctness & Guarantees:
   * 1. Generates the exact set of stay nights: [checkIn, checkOut).
   * 2. RoomTypes without inventory documents on a given night have FULL CAPACITY (totalInventory).
   * 3. Nights WITH inventory documents provide exact remaining rooms: (capacity - booked).
   * 4. Overall stay availability is the MINIMUM available rooms across ALL nights in the range.
   * 5. Filters out inactive room types and rooms where capacity < requested guests.
   */
  async searchAvailability(query: AvailabilitySearchQuery): Promise<RoomAvailabilityResult[]> {
    validateStayDates(query.checkIn, query.checkOut);

    const dates = getDateRangeArray(query.checkIn, query.checkOut);
    const totalNights = dates.length;
    const requestedGuests = query.guests ?? 1;
    const requestedRooms = query.rooms ?? 1;

    interface AggregationOutput extends Omit<IRoomTypeDocument, '_id'> {
      _id: { toString(): string };
      nightsCount: number;
      availableRooms: number;
      pricePerNight: number;
      totalPrice: number;
      isAvailable: boolean;
      createdAt: Date;
      updatedAt: Date;
    }

    const pipeline: PipelineStage[] = [
      // Step 1: Filter active room types capable of accommodating requested guests
      {
        $match: {
          isActive: true,
          capacity: { $gte: requestedGuests },
        },
      },
      // Step 2: Lookup recorded inventory docs for this room type within the stay dates
      {
        $lookup: {
          from: 'roominventories',
          let: { rId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$roomTypeId', '$$rId'] }, { $in: ['$date', dates] }],
                },
              },
            },
          ],
          as: 'inventoryDocs',
        },
      },
      // Step 3: Compute remaining available count for recorded nights
      {
        $addFields: {
          recordedAvailabilities: {
            $map: {
              input: '$inventoryDocs',
              as: 'inv',
              in: {
                $max: [0, { $subtract: ['$$inv.capacity', '$$inv.booked'] }],
              },
            },
          },
        },
      },
      // Step 4: Handle unrecorded nights (= totalInventory) and compute minimum across stay
      {
        $addFields: {
          availableRooms: {
            $cond: {
              if: { $eq: [{ $size: '$inventoryDocs' }, 0] },
              then: '$totalInventory',
              else: {
                $cond: {
                  if: { $lt: [{ $size: '$inventoryDocs' }, totalNights] },
                  then: {
                    $min: ['$totalInventory', { $min: '$recordedAvailabilities' }],
                  },
                  else: { $min: '$recordedAvailabilities' },
                },
              },
            },
          },
          nightsCount: totalNights,
        },
      },
      // Step 5: Calculate total price and availability flag
      {
        $addFields: {
          totalPrice: {
            $multiply: ['$pricePerNight', totalNights, requestedRooms],
          },
          isAvailable: {
            $gte: ['$availableRooms', requestedRooms],
          },
        },
      },
      // Step 6: Filter only rooms with at least requestedRooms available
      {
        $match: {
          availableRooms: { $gte: requestedRooms },
        },
      },
      // Step 7: Sort by price ascending, then stable createdAt desc
      {
        $sort: {
          pricePerNight: 1,
          createdAt: -1,
          _id: -1,
        },
      },
    ];

    const results = await RoomType.aggregate<AggregationOutput>(pipeline).exec();

    return results.map((row) => ({
      roomType: {
        id: row._id.toString(),
        name: row.name,
        description: row.description,
        capacity: row.capacity,
        facilities: row.facilities,
        pricePerNight: row.pricePerNight,
        totalInventory: row.totalInventory,
        isActive: row.isActive,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      nightsCount: row.nightsCount,
      availableRooms: row.availableRooms,
      pricePerNight: row.pricePerNight,
      totalPrice: row.totalPrice,
      isAvailable: row.isAvailable,
    }));
  }
}

export const roomTypeService = new RoomTypeService();
