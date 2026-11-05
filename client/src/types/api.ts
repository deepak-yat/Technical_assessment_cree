export type UserRole = 'GUEST' | 'STAFF' | 'ADMIN';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponseData {
  user: UserDto;
  accessToken: string;
}

export interface RoomTypeDto {
  id: string;
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomAvailabilityDto {
  roomType: RoomTypeDto;
  nightsCount: number;
  availableRooms: number;
  pricePerNight: number;
  totalPrice: number;
  isAvailable: boolean;
}

export const ReservationStatuses = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
} as const;

export type ReservationStatus = (typeof ReservationStatuses)[keyof typeof ReservationStatuses];

export interface StatusHistoryEntryDto {
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
  changedAt: string;
  reason?: string;
  changedBy?: string;
}

export interface ReservationDto {
  id: string;
  reference: string;
  guestId: string;
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guestCount: number;
  roomCount: number;
  priceSnapshot: number;
  totalAmount: number;
  status: ReservationStatus;
  idempotencyKey?: string | null;
  statusHistory: StatusHistoryEntryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffReservationItemDto extends ReservationDto {
  guestDetails: {
    id: string;
    name: string;
    email: string;
  };
  roomTypeName: string;
}

export interface DashboardSummaryDto {
  today: string;
  arrivalsToday: number;
  departuresToday: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  pendingCount: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}
