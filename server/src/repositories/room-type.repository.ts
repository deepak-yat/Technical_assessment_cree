import { RoomType, IRoomTypeDocument } from '../models/room-type.model.js';
import { ApiPaginationMeta } from '../common/utils/api-response.js';
import { FilterQuery, ClientSession } from 'mongoose';

export interface CreateRoomTypeData {
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive?: boolean;
  imageUrl?: string;
}

export interface UpdateRoomTypeData {
  name?: string;
  description?: string;
  capacity?: number;
  facilities?: string[];
  pricePerNight?: number;
  totalInventory?: number;
  isActive?: boolean;
  imageUrl?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: ApiPaginationMeta;
}

export class RoomTypeRepository {
  async findById(id: string): Promise<IRoomTypeDocument | null> {
    return RoomType.findById(id).exec();
  }

  async findByName(name: string): Promise<IRoomTypeDocument | null> {
    return RoomType.findOne({ name: name.trim() }).exec();
  }

  async create(data: CreateRoomTypeData): Promise<IRoomTypeDocument> {
    const roomType = new RoomType(data);
    return roomType.save();
  }

  async update(
    id: string,
    data: UpdateRoomTypeData,
    session?: ClientSession,
  ): Promise<IRoomTypeDocument | null> {
    return RoomType.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
      session: session || null,
    }).exec();
  }

  async delete(id: string): Promise<IRoomTypeDocument | null> {
    return RoomType.findByIdAndDelete(id).exec();
  }

  async listPaginated(
    filter: FilterQuery<IRoomTypeDocument>,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<IRoomTypeDocument>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [total, data] = await Promise.all([
      RoomType.countDocuments(filter).exec(),
      RoomType.find(filter)
        .sort({ createdAt: -1, _id: -1 }) // Stable sort: createdAt desc + _id desc
        .skip(skip)
        .limit(safeLimit)
        .exec(),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

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

export const roomTypeRepository = new RoomTypeRepository();
