import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AddFriendSchema, ApiErrorSchema, FriendListSchema, FriendSchema } from '@aphno/shared';
import { addFriend, listFriends } from './friend.service.js';

// Controller: thin HTTP layer over the friend service.
export async function friendRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/v1/friends',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'List my friends (1-on-1) with net balances',
        security: [{ bearerAuth: [] }],
        response: { 200: FriendListSchema },
      },
    },
    (req) => listFriends(req.userId),
  );

  app.post(
    '/v1/friends',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Add a friend by phone',
        description:
          'Resolves (or stub-creates) the person and returns the 1-on-1 thread. Idempotent — re-adding returns the existing thread.',
        security: [{ bearerAuth: [] }],
        body: AddFriendSchema,
        response: { 201: FriendSchema, 422: ApiErrorSchema },
      },
    },
    async (req, reply) => {
      const friend = await addFriend(req.userId, req.body.phone, req.body.name);
      reply.status(201);
      return friend;
    },
  );
}
