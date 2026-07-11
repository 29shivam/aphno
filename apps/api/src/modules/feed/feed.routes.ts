import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FeedResponseSchema } from '@aphno/shared';
import { getFeed } from './feed.service.js';

// Controller: validates the query DTO and delegates to the feed service.
export async function feedRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/v1/feed',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['feed'],
        summary: 'Global activity feed across all the user’s groups (newest first)',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(40) }),
        response: { 200: FeedResponseSchema },
      },
    },
    (req) => getFeed(req.userId, req.query.limit),
  );
}
