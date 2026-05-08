import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { logger } from './platform/logger.js';
import { healthRoutes } from './modules/health/health.routes.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cors, { origin: true });
  await app.register(sensible);

  await app.register(healthRoutes);

  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, 'unhandled error');
    reply.status(err.statusCode ?? 500).send({
      error: {
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message ?? 'Something went wrong',
      },
    });
  });

  return app;
}
