import { Server } from 'node:http';
import { app } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './common/utils/logger.js';

let server: Server | null = null;

async function bootstrap(): Promise<void> {
  try {
    // 1. Establish Database Connection
    logger.info('Connecting to MongoDB...');
    await connectDatabase(config.MONGODB_URI);

    // 2. Start HTTP Server
    server = app.listen(config.PORT, () => {
      logger.info(
        {
          port: config.PORT,
          env: config.NODE_ENV,
          apiPrefix: config.API_PREFIX,
        },
        `Hotel API server running on http://localhost:${config.PORT}`,
      );
    });
  } catch (error) {
    logger.fatal({ error }, 'Bootstrap sequence failed');
    process.exit(1);
  }
}

// 3. Graceful Shutdown Management
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown initiated');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out (10s), forcing process termination');
    process.exit(1);
  }, 10000);

  // Unref timeout so it does not hold the event loop open if everything closes smoothly
  shutdownTimeout.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) return reject(err);
          logger.info('HTTP server closed, no longer accepting new connections');
          resolve();
        });
      });
    }

    await disconnectDatabase();
    logger.info('All connections terminated successfully. Process exiting.');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error occurred during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection detected');
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ error }, 'Uncaught Exception detected');
  gracefulShutdown('uncaughtException');
});

void bootstrap();
