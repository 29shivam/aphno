import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma, type Prisma } from '@aphno/db';
import {
  ApiErrorSchema,
  CompleteSettlementSchema,
  CreateSettlementSchema,
  SettlementSchema,
  uuid,
} from '@aphno/shared';
import { buildUpiIntent } from '../../platform/upi.js';
import { assertMember } from '../groups/group.service.js';

const GroupIdParam = z.object({ id: uuid });
const SettlementIdParam = z.object({ id: uuid });

export async function settlementsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Record a settlement (I pay someone back) ────────────────────────────────
  app.post(
    '/v1/groups/:id/settlements',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['settlements'],
        summary: 'Record a settlement and get a UPI pay link',
        description:
          'Creates a PENDING settlement from the caller to `toUserId` and returns a `upi://pay` deep link (when the payee has a UPI id). Confirm it via the complete endpoint once paid.',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        body: CreateSettlementSchema,
        response: {
          201: SettlementSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          422: ApiErrorSchema,
        },
      },
    },
    async (req, reply) => {
      await assertMember(req.params.id, req.userId);

      if (req.body.toUserId === req.userId) {
        return reply
          .status(422)
          .send({ error: { code: 'INVALID_SETTLEMENT', message: 'cannot settle with yourself' } });
      }
      await assertMember(req.params.id, req.body.toUserId);

      const settlement = await prisma.settlement.create({
        data: {
          groupId: req.params.id,
          fromUserId: req.userId,
          toUserId: req.body.toUserId,
          amount: req.body.amount,
          note: req.body.note ?? null,
          status: 'PENDING',
        },
        include: { toUser: true },
      });

      reply.status(201);
      return serializeSettlement(settlement);
    },
  );

  // ── Confirm a settlement was paid ───────────────────────────────────────────
  app.post(
    '/v1/settlements/:id/complete',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['settlements'],
        summary: 'Mark a settlement as completed',
        description: 'Only the payer can confirm. Optionally attach the UPI transaction reference.',
        security: [{ bearerAuth: [] }],
        params: SettlementIdParam,
        body: CompleteSettlementSchema,
        response: {
          200: SettlementSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const existing = await prisma.settlement.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return reply
          .status(404)
          .send({ error: { code: 'SETTLEMENT_NOT_FOUND', message: 'settlement not found' } });
      }
      if (existing.fromUserId !== req.userId) {
        return reply
          .status(403)
          .send({ error: { code: 'FORBIDDEN', message: 'only the payer can confirm' } });
      }
      if (existing.status !== 'PENDING') {
        return reply.status(409).send({
          error: { code: 'ALREADY_RESOLVED', message: `settlement is already ${existing.status}` },
        });
      }

      const settlement = await prisma.settlement.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          settledAt: new Date(),
          upiTxnRef: req.body.upiTxnRef ?? null,
        },
        include: { toUser: true },
      });
      return serializeSettlement(settlement);
    },
  );

  // ── List a group's settlements ──────────────────────────────────────────────
  app.get(
    '/v1/groups/:id/settlements',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['settlements'],
        summary: 'List a group’s settlements (newest first)',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        response: { 200: z.array(SettlementSchema), 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req) => {
      await assertMember(req.params.id, req.userId);
      const settlements = await prisma.settlement.findMany({
        where: { groupId: req.params.id },
        include: { toUser: true },
        orderBy: { createdAt: 'desc' },
      });
      return settlements.map(serializeSettlement);
    },
  );
}

type SettlementWithPayee = Prisma.SettlementGetPayload<{ include: { toUser: true } }>;

function serializeSettlement(s: SettlementWithPayee) {
  const upiIntentUrl = s.toUser.upiId
    ? buildUpiIntent({
        payeeVpa: s.toUser.upiId,
        payeeName: s.toUser.name,
        amountPaise: s.amount,
        note: s.note ?? 'aphno.ai settle-up',
      })
    : null;

  return {
    id: s.id,
    groupId: s.groupId,
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount,
    status: s.status,
    method: s.method,
    upiTxnRef: s.upiTxnRef,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    settledAt: s.settledAt?.toISOString() ?? null,
    upiIntentUrl,
  };
}
