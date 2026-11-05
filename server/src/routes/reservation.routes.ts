import { Router } from 'express';
import { reservationController } from '../controllers/reservation.controller.js';
import { validateRequest } from '../common/middleware/validate.js';
import {
  createReservationSchema,
  listMyReservationsSchema,
  cancelReservationSchema,
} from '../schemas/reservation.schema.js';
import { authenticate } from '../common/middleware/auth.js';
import { bookingRateLimiter } from '../common/middleware/rate-limiter.js';

const router = Router();

// All guest reservation endpoints require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/reservations
 * @desc    Book a new reservation (ACID transaction with per-night conditional updates)
 * @access  Private (Authenticated users)
 */
router.post('/', bookingRateLimiter, validateRequest(createReservationSchema), (req, res, next) =>
  reservationController.create(req, res, next),
);

/**
 * @route   GET /api/v1/reservations/mine
 * @desc    List reservations belonging to the current authenticated guest (paginated)
 * @access  Private (Guest / Staff)
 */
router.get('/mine', validateRequest(listMyReservationsSchema), (req, res, next) =>
  reservationController.getMyReservations(req, res, next),
);

/**
 * @route   GET /api/v1/reservations/:id
 * @desc    Get details of a reservation (guests can only view their own)
 * @access  Private
 */
router.get('/:id', (req, res, next) => reservationController.getById(req, res, next));

/**
 * @route   POST /api/v1/reservations/:id/cancel
 * @desc    Cancel a reservation with exactly-once inventory release
 * @access  Private
 */
router.post('/:id/cancel', validateRequest(cancelReservationSchema), (req, res, next) =>
  reservationController.cancel(req, res, next),
);

export const reservationRoutes = router;
