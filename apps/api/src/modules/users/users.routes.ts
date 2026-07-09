import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '@aphno/db';
import { ApiErrorSchema, UpdateProfileSchema, UserSchema } from '@aphno/shared';
import { toUserDto } from './user.dto.js';

export async function usersRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Current profile ─────────────────────────────────────────────────────────
  app.get(
    '/v1/users/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        summary: 'Get the signed-in user',
        security: [{ bearerAuth: [] }],
        response: { 200: UserSchema, 401: ApiErrorSchema },
      },
    },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'user gone' } });
      }
      return toUserDto(user);
    },
  );

  // ── Update profile (name / UPI id / avatar) ─────────────────────────────────
  app.patch(
    '/v1/users/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        summary: 'Update the signed-in user',
        description: 'Set the display name and UPI id used when others pay you back.',
        security: [{ bearerAuth: [] }],
        body: UpdateProfileSchema,
        response: { 200: UserSchema, 401: ApiErrorSchema },
      },
    },
    async (req) => {
      const user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.upiId !== undefined ? { upiId: req.body.upiId } : {}),
          ...(req.body.avatarUrl !== undefined ? { avatarUrl: req.body.avatarUrl } : {}),
        },
      });
      return toUserDto(user);
    },
  );
}
