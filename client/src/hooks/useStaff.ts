import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi, StaffReservationQueryParams } from '../api/staff.api.js';
import { ReservationStatus } from '../types/api.js';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => staffApi.getDashboard(),
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useStaffReservations(params: StaffReservationQueryParams) {
  return useQuery({
    queryKey: ['staffReservations', params],
    queryFn: () => staffApi.listReservations(params),
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.checkIn(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staffReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.checkOut(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staffReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
    },
  });
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: ReservationStatus;
      reason?: string;
    }) => staffApi.updateStatus(id, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staffReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
    },
  });
}
