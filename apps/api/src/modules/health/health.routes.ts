import type { FastifyInstance } from 'fastify';
import { prisma } from '@aphno/db';
import { HealthResponseSchema } from '@aphno/shared';

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/v1/health',
    {
      schema: {
        response: { 200: HealthResponseSchema },
      },
    },
    async () => {
      let dbConnected = false;
      let userCount = 0;
      try {
        userCount = await prisma.user.count();
        dbConnected = true;
      } catch (err) {
        app.log.error({ err }, 'health check db failed');
      }

      return {
        status: 'ok' as const,
        uptime: process.uptime(),
        dbConnected,
        userCount,
        timestamp: new Date().toISOString(),
      };
    },
  );
}
