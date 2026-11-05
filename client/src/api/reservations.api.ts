import { apiClient } from './client.js';
import { ApiResponse, PaginationMeta, ReservationDto } from '../types/api.js';

export interface CreateReservationInput {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomCount: number;
}

export const reservationsApi = {
  async create(input: CreateReservationInput, idempotencyKey?: string): Promise<ReservationDto> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await apiClient.post<ApiResponse<ReservationDto>>('/reservations', input, {
      headers,
    });
    return res.data.data;
  },

  async listMine(page = 1, limit = 10): Promise<{ data: ReservationDto[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<ReservationDto[]>>('/reservations/mine', {
      params: { page, limit },
    });
    return {
      data: res.data.data,
      meta: res.data.meta ?? { page, limit, total: res.data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<ReservationDto> {
    const res = await apiClient.get<ApiResponse<ReservationDto>>(`/reservations/${id}`);
    return res.data.data;
  },

  async cancel(id: string, reason?: string): Promise<ReservationDto> {
    const res = await apiClient.post<ApiResponse<{ reservation: ReservationDto }>>(
      `/reservations/${id}/cancel`,
      { reason },
    );
    return res.data.data.reservation;
  },
};
