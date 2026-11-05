import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const createReservationSchema = z.object({
  body: z.object({
    roomTypeId: z
      .string({ required_error: 'roomTypeId is required' })
      .regex(OBJECT_ID_REGEX, 'Invalid roomTypeId format'),
    checkIn: z
      .string({ required_error: 'checkIn date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be formatted as YYYY-MM-DD'),
    checkOut: z
      .string({ required_error: 'checkOut date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be formatted as YYYY-MM-DD'),
    guestCount: z
      .number({ required_error: 'guestCount is required' })
      .int('guestCount must be an integer')
      .min(1, 'guestCount must be at least 1'),
    roomCount: z
      .number()
      .int('roomCount must be an integer')
      .min(1, 'roomCount must be at least 1')
      .default(1),
  }),
});

export const listMyReservationsSchema = z.object({
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
  }),
});

export const cancelReservationSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
  }),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>['body'];
export type ListMyReservationsQuery = z.infer<typeof listMyReservationsSchema>['query'];
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>['body'];
