import { Router } from 'express';
import { roomTypeController } from '../controllers/room-type.controller.js';
import { validateRequest } from '../common/middleware/validate.js';
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  listRoomTypesSchema,
  availabilitySearchSchema,
} from '../schemas/room-type.schema.js';
import { authenticate, authorize } from '../common/middleware/auth.js';
import { availabilityRateLimiter } from '../common/middleware/rate-limiter.js';
import { UserRoles } from '../types/auth.types.js';

const router = Router();

// ============================================================================
// Public Endpoints
// ============================================================================

/**
 * @route   GET /api/v1/room-types/availability
 * @desc    Search room availability across stay dates with minimum room calculation
 * @access  Public
 */
router.get(
  '/availability',
  availabilityRateLimiter,
  validateRequest(availabilitySearchSchema),
  (req, res, next) => roomTypeController.searchAvailability(req, res, next),
);

/**
 * @route   GET /api/v1/room-types
 * @desc    Public listing of active room types (server-side paginated)
 * @access  Public
 */
router.get('/', validateRequest(listRoomTypesSchema), (req, res, next) =>
  roomTypeController.listPublic(req, res, next),
);

/**
 * @route   GET /api/v1/room-types/staff/all
 * @desc    Staff listing of all room types including inactive ones (paginated)
 * @access  Staff / Admin
 */
router.get(
  '/staff/all',
  authenticate,
  authorize(UserRoles.STAFF),
  validateRequest(listRoomTypesSchema),
  (req, res, next) => roomTypeController.listStaff(req, res, next),
);

/**
 * @route   GET /api/v1/room-types/:id
 * @desc    Get details of a specific room type
 * @access  Public
 */
router.get('/:id', (req, res, next) => roomTypeController.getById(req, res, next));

// ============================================================================
// Staff-Protected Endpoints
// ============================================================================

/**
 * @route   POST /api/v1/room-types
 * @desc    Create a new room type
 * @access  Staff / Admin
 */
router.post(
  '/',
  authenticate,
  authorize(UserRoles.STAFF),
  validateRequest(createRoomTypeSchema),
  (req, res, next) => roomTypeController.create(req, res, next),
);

/**
 * @route   PUT /api/v1/room-types/:id
 * @desc    Update a room type (rejects lowering inventory below already-booked nights)
 * @access  Staff / Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRoles.STAFF),
  validateRequest(updateRoomTypeSchema),
  (req, res, next) => roomTypeController.update(req, res, next),
);

/**
 * @route   PATCH /api/v1/room-types/:id/status
 * @desc    Activate or deactivate a room type
 * @access  Staff / Admin
 */
router.patch('/:id/status', authenticate, authorize(UserRoles.STAFF), (req, res, next) =>
  roomTypeController.setStatus(req, res, next),
);

/**
 * @route   DELETE /api/v1/room-types/:id
 * @desc    Delete a room type (only if no future bookings exist)
 * @access  Staff / Admin
 */
router.delete('/:id', authenticate, authorize(UserRoles.STAFF), (req, res, next) =>
  roomTypeController.delete(req, res, next),
);

export const roomTypeRoutes = router;
