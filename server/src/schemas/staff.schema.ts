import { z } from 'zod';
import { ReservationStatuses } from '../common/state/reservation-state-machine.js';

export const staffReservationQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'Page must be a positive integer',
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
        message: 'Limit must be an integer between 1 and 100',
      }),
    status: z.enum(Object.values(ReservationStatuses) as [string, ...string[]]).optional(),
    checkInFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkInFrom must be formatted as YYYY-MM-DD')
      .optional(),
    checkInTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkInTo must be formatted as YYYY-MM-DD')
      .optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(['createdAt', 'checkIn', 'checkOut', 'totalAmount']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const updateReservationStatusSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(ReservationStatuses) as [string, ...string[]], {
      required_error: 'Target status is required',
    }),
    reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
  }),
});

export type StaffReservationQuery = z.infer<typeof staffReservationQuerySchema>['query'];
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>['body'];
