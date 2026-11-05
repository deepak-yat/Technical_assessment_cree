import { apiClient } from './client.js';
import {
  ApiResponse,
  DashboardSummaryDto,
  PaginationMeta,
  ReservationDto,
  ReservationStatus,
  StaffReservationItemDto,
} from '../types/api.js';

export interface StaffReservationQueryParams {
  page?: number;
  limit?: number;
  status?: ReservationStatus;
  checkInFrom?: string;
  checkInTo?: string;
  search?: string;
  sortBy?: 'createdAt' | 'checkIn' | 'checkOut' | 'totalAmount';
  sortOrder?: 'asc' | 'desc';
}

export const staffApi = {
  async getDashboard(): Promise<DashboardSummaryDto> {
    const res = await apiClient.get<ApiResponse<DashboardSummaryDto>>('/staff/dashboard');
    return res.data.data;
  },

  async listReservations(
    params: StaffReservationQueryParams,
  ): Promise<{ data: StaffReservationItemDto[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<StaffReservationItemDto[]>>('/staff/reservations', {
      params,
    });
    return {
      data: res.data.data,
      meta: res.data.meta ?? { page: 1, limit: 10, total: res.data.data.length, totalPages: 1 },
    };
  },

  async updateStatus(
    id: string,
    status: ReservationStatus,
    reason?: string,
  ): Promise<ReservationDto> {
    const res = await apiClient.patch<ApiResponse<{ reservation: ReservationDto }>>(
      `/staff/reservations/${id}/status`,
      { status, reason },
    );
    return res.data.data.reservation;
  },

  async checkIn(id: string): Promise<ReservationDto> {
    const res = await apiClient.post<ApiResponse<{ reservation: ReservationDto }>>(
      `/staff/reservations/${id}/check-in`,
    );
    return res.data.data.reservation;
  },

  async checkOut(id: string): Promise<ReservationDto> {
    const res = await apiClient.post<ApiResponse<{ reservation: ReservationDto }>>(
      `/staff/reservations/${id}/check-out`,
    );
    return res.data.data.reservation;
  },
};
