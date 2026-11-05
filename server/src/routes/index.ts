import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { roomTypeRoutes } from './room-type.routes.js';
import { reservationRoutes } from './reservation.routes.js';
import { staffRoutes } from './staff.routes.js';
import { authenticate, authorize } from '../common/middleware/auth.js';
import { UserRoles } from '../types/auth.types.js';
import { sendSuccess } from '../common/utils/api-response.js';

const apiRouter = Router();

// Mount health checks
apiRouter.use(healthRoutes);

// Mount authentication routes
apiRouter.use('/auth', authRoutes);

// Mount room type routes
apiRouter.use('/room-types', roomTypeRoutes);

// Mount reservation routes
apiRouter.use('/reservations', reservationRoutes);

// Mount staff operations routes
apiRouter.use('/staff', staffRoutes);

// Protected Staff-only test endpoint to verify RBAC enforcement
apiRouter.get('/staff-test', authenticate, authorize(UserRoles.STAFF), (req, res) => {
  return sendSuccess(res, {
    message: 'Staff access granted',
    user: req.user,
  });
});

export { apiRouter };
