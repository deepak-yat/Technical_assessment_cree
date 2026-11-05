import { z } from 'zod';

export const createRoomTypeSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Room type name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description cannot exceed 2000 characters'),
    capacity: z
      .number({ required_error: 'Capacity is required' })
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be at least 1 person')
      .max(20, 'Capacity cannot exceed 20 persons'),
    facilities: z.array(z.string().trim().min(1, 'Facility cannot be empty')).default([]),
    pricePerNight: z
      .number({ required_error: 'Price per night is required' })
      .min(0, 'Price per night cannot be negative'),
    totalInventory: z
      .number({ required_error: 'Total inventory is required' })
      .int('Total inventory must be an integer')
      .min(1, 'Total inventory must be at least 1 room'),
    isActive: z.boolean().default(true),
    imageUrl: z.string().trim().optional(),
  }),
});

export const updateRoomTypeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().min(10).max(2000).optional(),
      capacity: z.number().int().min(1).max(20).optional(),
      facilities: z.array(z.string().trim().min(1)).optional(),
      pricePerNight: z.number().min(0).optional(),
      totalInventory: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
      imageUrl: z.string().trim().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const listRoomTypesSchema = z.object({
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
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
  }),
});

export const availabilitySearchSchema = z.object({
  query: z.object({
    checkIn: z
      .string({ required_error: 'checkIn date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be formatted as YYYY-MM-DD'),
    checkOut: z
      .string({ required_error: 'checkOut date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be formatted as YYYY-MM-DD'),
    guests: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'Guests count must be at least 1',
      }),
    rooms: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'Rooms count must be at least 1',
      }),
  }),
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>['body'];
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>['body'];
export type ListRoomTypesQuery = z.infer<typeof listRoomTypesSchema>['query'];
export type AvailabilitySearchQuery = z.infer<typeof availabilitySearchSchema>['query'];
