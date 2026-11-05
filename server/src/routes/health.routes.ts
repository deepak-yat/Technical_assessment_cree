import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import { sendSuccess } from '../common/utils/api-response.js';

const router = Router();

/**
 * @route   GET /health
 * @desc    Liveness check - returns UP if process is alive and accepting connections
 * @access  Public
 */
router.get('/health', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * @route   GET /ready
 * @desc    Readiness check - returns UP if critical dependencies (MongoDB) are healthy
 * @access  Public
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();

  if (!dbHealth.isHealthy) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is not ready to receive traffic',
        details: {
          database: {
            status: 'DISCONNECTED',
            error: dbHealth.error,
          },
        },
      },
    });
  }

  return sendSuccess(res, {
    status: 'UP',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        status: 'CONNECTED',
        latencyMs: dbHealth.latencyMs,
      },
    },
  });
});

export const healthRoutes = router;
