import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { logger } from './platform/logger.js';
import { env } from './platform/env.js';
import { healthRoutes } from './modules/health/health.routes.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // helmet's default CSP blocks swagger-ui inline assets — relax in dev only
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });
  await app.register(cors, { origin: true });
  await app.register(sensible);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'APHNO API',
        description: 'UPI-native splits + financial intelligence',
        version: '0.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local dev' }],
      tags: [
        { name: 'health', description: 'Service health' },
        { name: 'auth', description: 'Phone OTP authentication' },
        { name: 'users', description: 'User profile' },
        { name: 'groups', description: 'Group management' },
        { name: 'expenses', description: 'Expense tracking' },
        { name: 'settlements', description: 'UPI settlements' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
  });

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
