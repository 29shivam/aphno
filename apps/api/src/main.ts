import { prisma } from '@aphno/db';
import { buildApp } from './app.js';
import { env } from './platform/env.js';
import { logger } from './platform/logger.js';

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    try {
      await app.close();
      await prisma.$disconnect();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => void shutdown(sig));
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`api listening on :${env.PORT} — docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

void start();
