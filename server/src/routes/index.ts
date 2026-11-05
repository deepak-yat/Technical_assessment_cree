import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { roomTypeRoutes } from './room-type.routes.js';
import { reservationRoutes } from './reservation.routes.js';
import { staffRoutes } from './staff.routes.js';

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

export { apiRouter };
