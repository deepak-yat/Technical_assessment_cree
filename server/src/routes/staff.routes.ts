import { Router } from 'express';
import { staffController } from '../controllers/staff.controller.js';
import { validateRequest } from '../common/middleware/validate.js';
import {
  staffReservationQuerySchema,
  updateReservationStatusSchema,
} from '../schemas/staff.schema.js';
import { authenticate, authorize } from '../common/middleware/auth.js';
import { UserRoles } from '../types/auth.types.js';

const router = Router();

// Protect all staff operations with Staff/Admin RBAC
router.use(authenticate, authorize(UserRoles.STAFF));

/**
 * @route   GET /api/v1/staff/dashboard
 * @desc    Front-desk overview KPIs (arrivals, departures, occupied, pending, occupancy rate)
 * @access  Staff / Admin
 */
router.get('/dashboard', (req, res, next) => staffController.getDashboard(req, res, next));

/**
 * @route   GET /api/v1/staff/reservations
 * @desc    List, filter, and search reservations with server-side pagination & sorting
 * @access  Staff / Admin
 */
router.get('/reservations', validateRequest(staffReservationQuerySchema), (req, res, next) =>
  staffController.listReservations(req, res, next),
);

/**
 * @route   POST /api/v1/staff/reservations/:id/check-in
 * @desc    Front-desk guest check-in (requires CONFIRMED, today >= checkIn)
 * @access  Staff / Admin
 */
router.post('/reservations/:id/check-in', (req, res, next) =>
  staffController.checkIn(req, res, next),
);

/**
 * @route   POST /api/v1/staff/reservations/:id/check-out
 * @desc    Front-desk guest check-out (requires CHECKED_IN, releases inventory)
 * @access  Staff / Admin
 */
router.post('/reservations/:id/check-out', (req, res, next) =>
  staffController.checkOut(req, res, next),
);

/**
 * @route   PATCH /api/v1/staff/reservations/:id/status
 * @desc    Update reservation status using the strict transition state machine
 * @access  Staff / Admin
 */
router.patch(
  '/reservations/:id/status',
  validateRequest(updateReservationStatusSchema),
  (req, res, next) => staffController.updateStatus(req, res, next),
);

export const staffRoutes = router;
