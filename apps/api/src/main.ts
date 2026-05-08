import { buildApp } from './app.js';
import { env } from './platform/env.js';
import { logger } from './platform/logger.js';

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`api listening on :${env.PORT}`);
  } catch (err) {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

start();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info(`${sig} received, shutting down`);
    process.exit(0);
  });
}
