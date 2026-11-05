import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  roomTypesApi,
  AvailabilitySearchParams,
  CreateRoomTypeInput,
  UpdateRoomTypeInput,
} from '../api/room-types.api.js';

export function useRoomTypes(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['roomTypes', { page, limit }],
    queryFn: () => roomTypesApi.list(page, limit),
  });
}

export function useRoomType(id: string | undefined) {
  return useQuery({
    queryKey: ['roomType', id],
    queryFn: () => roomTypesApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useAvailabilitySearch(params: AvailabilitySearchParams | null) {
  return useQuery({
    queryKey: ['availabilitySearch', params],
    queryFn: () => roomTypesApi.searchAvailability(params!),
    enabled: Boolean(params && params.checkIn && params.checkOut && params.guests > 0),
  });
}

export function useStaffRoomTypes(page = 1, limit = 10, isActive?: boolean) {
  return useQuery({
    queryKey: ['staffRoomTypes', { page, limit, isActive }],
    queryFn: () => roomTypesApi.listStaff(page, limit, isActive),
  });
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoomTypeInput) => roomTypesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      void queryClient.invalidateQueries({ queryKey: ['staffRoomTypes'] });
    },
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoomTypeInput }) =>
      roomTypesApi.update(id, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      void queryClient.invalidateQueries({ queryKey: ['staffRoomTypes'] });
      void queryClient.invalidateQueries({ queryKey: ['roomType', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
    },
  });
}

export function useSetRoomTypeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      roomTypesApi.setStatus(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      void queryClient.invalidateQueries({ queryKey: ['staffRoomTypes'] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
    },
  });
}
