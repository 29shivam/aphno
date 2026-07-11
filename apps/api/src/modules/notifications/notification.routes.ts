import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MarkReadSchema, NotificationListSchema, ApiErrorSchema } from '@aphno/shared';
import { notificationRepository } from './notification.repository.js';
import { toNotificationDto } from './notification.service.js';

// Controller: thin HTTP layer. Validates via DTOs, delegates to the repository,
// maps rows → DTOs. No business logic or Prisma access lives here.
export async function notificationRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/v1/notifications',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['notifications'],
        summary: 'List the current user’s notifications (newest first) with unread count',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }),
        response: { 200: NotificationListSchema },
      },
    },
    async (req) => {
      const [rows, unreadCount] = await Promise.all([
        notificationRepository.listByUser(req.userId, req.query.limit),
        notificationRepository.countUnread(req.userId),
      ]);
      return { items: rows.map(toNotificationDto), unreadCount };
    },
  );

  app.post(
    '/v1/notifications/read',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['notifications'],
        summary: 'Mark notifications read',
        description: 'Marks the given notification ids read, or all unread when `ids` is omitted.',
        security: [{ bearerAuth: [] }],
        body: MarkReadSchema,
        response: { 200: z.object({ updated: z.number().int() }), 401: ApiErrorSchema },
      },
    },
    async (req) => {
      const updated = await notificationRepository.markRead(req.userId, req.body.ids);
      return { updated };
    },
  );
}
