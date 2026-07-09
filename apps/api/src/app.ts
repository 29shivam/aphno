import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  hasZodFastifySchemaValidationErrors,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { logger } from './platform/logger.js';
import { env } from './platform/env.js';
import authPlugin from './platform/auth.plugin.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { groupsRoutes } from './modules/groups/groups.routes.js';
import { expensesRoutes } from './modules/expenses/expenses.routes.js';
import { settlementsRoutes } from './modules/settlements/settlements.routes.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Must be set BEFORE routes: child encapsulation contexts snapshot the
  // error handler at register() time, so a later call wouldn't reach them.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    // Zod body/params/query validation failures → 400 with field details.
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'request failed validation',
          details: { issues: err.validation },
        },
      });
    }

    const statusCode = err.statusCode ?? 500;
    // Only 5xx are unexpected; log those loudly, keep 4xx quiet.
    if (statusCode >= 500) {
      req.log.error({ err }, 'unhandled error');
    }
    return reply.status(statusCode).send({
      error: {
        code: err.code ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message: statusCode >= 500 ? 'Something went wrong' : err.message,
      },
    });
  });

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

  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(groupsRoutes);
  await app.register(expensesRoutes);
  await app.register(settlementsRoutes);

  return app;
}
