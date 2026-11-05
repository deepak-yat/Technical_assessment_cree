import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, CreateReservationInput } from '../api/reservations.api.js';

export function useMyReservations(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['myReservations', { page, limit }],
    queryFn: () => reservationsApi.listMine(page, limit),
  });
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => reservationsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateReservationInput;
      idempotencyKey?: string;
    }) => reservationsApi.create(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['myReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
      void queryClient.invalidateQueries({ queryKey: ['staffReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reservationsApi.cancel(id, reason),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['myReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['availabilitySearch'] });
      void queryClient.invalidateQueries({ queryKey: ['staffReservations'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}
