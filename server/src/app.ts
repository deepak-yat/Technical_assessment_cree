import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { requestLogger } from './common/middleware/request-logger.js';
import { notFoundHandler } from './common/middleware/not-found.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { healthRoutes } from './routes/health.routes.js';

export function createApp(): Application {
  const app: Application = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. CORS Allowlist Configuration
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin '${origin}' is not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  // 3. Body Parsing Middleware
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // 4. Request ID & Structured HTTP Logging
  app.use(requestLogger);

  // Ensure X-Request-Id is echoed in response headers for traceability
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = req.id || req.headers['x-request-id'];
    if (reqId) {
      res.setHeader('X-Request-Id', String(reqId));
    }
    next();
  });

  // 5. Root Health Endpoints (convenient for cloud load balancers / orchestrators)
  app.use(healthRoutes);

  // 6. Versioned API Routes (/api/v1)
  app.use(config.API_PREFIX, apiRouter);

  // 7. 404 Catch-all Handler
  app.use(notFoundHandler);

  // 8. Central Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
