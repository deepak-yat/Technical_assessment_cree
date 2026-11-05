import { apiClient } from './client.js';
import { ApiResponse, PaginationMeta, RoomAvailabilityDto, RoomTypeDto } from '../types/api.js';

export interface AvailabilitySearchParams {
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface CreateRoomTypeInput {
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive?: boolean;
  imageUrl?: string;
}

export type UpdateRoomTypeInput = Partial<CreateRoomTypeInput>;

export const roomTypesApi = {
  async list(page = 1, limit = 10): Promise<{ data: RoomTypeDto[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<RoomTypeDto[]>>('/room-types', {
      params: { page, limit },
    });
    return {
      data: res.data.data,
      meta: res.data.meta ?? { page, limit, total: res.data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<RoomTypeDto> {
    const res = await apiClient.get<ApiResponse<RoomTypeDto>>(`/room-types/${id}`);
    return res.data.data;
  },

  async searchAvailability(params: AvailabilitySearchParams): Promise<RoomAvailabilityDto[]> {
    const res = await apiClient.get<ApiResponse<RoomAvailabilityDto[]>>(
      '/room-types/availability',
      {
        params,
      },
    );
    return res.data.data;
  },

  async listStaff(
    page = 1,
    limit = 10,
    isActive?: boolean,
  ): Promise<{ data: RoomTypeDto[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<RoomTypeDto[]>>('/room-types/staff/all', {
      params: { page, limit, isActive },
    });
    return {
      data: res.data.data,
      meta: res.data.meta ?? { page, limit, total: res.data.data.length, totalPages: 1 },
    };
  },

  async create(data: CreateRoomTypeInput): Promise<RoomTypeDto> {
    const res = await apiClient.post<ApiResponse<RoomTypeDto>>('/room-types', data);
    return res.data.data;
  },

  async update(id: string, data: UpdateRoomTypeInput): Promise<RoomTypeDto> {
    const res = await apiClient.put<ApiResponse<{ roomType: RoomTypeDto }>>(
      `/room-types/${id}`,
      data,
    );
    return res.data.data.roomType;
  },

  async setStatus(id: string, isActive: boolean): Promise<RoomTypeDto> {
    const res = await apiClient.patch<ApiResponse<{ roomType: RoomTypeDto }>>(
      `/room-types/${id}/status`,
      {
        isActive,
      },
    );
    return res.data.data.roomType;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/room-types/${id}`);
  },
};
