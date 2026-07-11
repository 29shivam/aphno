import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma, type Prisma } from '@aphno/db';
import {
  ApiErrorSchema,
  CreateExpenseSchema,
  ExpenseSchema,
  UpdateExpenseSchema,
  uuid,
  type CreateExpense,
} from '@aphno/shared';
import { splitEqual, splitExact, splitPercent } from '../../platform/money.js';
import { assertMember } from '../groups/group.service.js';
import { notifyExpense } from '../notifications/notification.service.js';

// Side-effect: notify the other participants that an expense was added/edited.
// Resolves the actor + group names, then hands off to the notification service.
async function fireExpenseNotification(
  groupId: string,
  actorId: string,
  expense: { id: string; description: string; splits: { userId: string; amount: number }[] },
  edited: boolean,
) {
  const [group, actor] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true, phone: true } }),
  ]);
  await notifyExpense(
    { id: expense.id, groupId, description: expense.description, splits: expense.splits },
    {
      actorId,
      actorName: actor?.name ?? actor?.phone ?? 'Someone',
      groupName: group?.name ?? 'your group',
      edited,
    },
  );
}

const GroupIdParam = z.object({ id: uuid });
const ExpenseIdParam = z.object({ id: uuid });

// Raised for bad split math / non-member participants. 422 = unprocessable.
class ExpenseValidationError extends Error {
  statusCode = 422;
  code = 'INVALID_EXPENSE';
}

/** Resolve the owed-share map for an expense against the group's members. */
function buildShares(body: CreateExpense, memberIds: Set<string>): Map<string, number> {
  if (body.splitType === 'EQUAL') {
    const participants = body.participants ?? [...memberIds];
    for (const id of participants) {
      if (!memberIds.has(id)) throw new ExpenseValidationError(`user ${id} is not in this group`);
    }
    return splitEqual(body.amount, participants);
  }

  const splits = body.splits ?? [];
  for (const s of splits) {
    if (!memberIds.has(s.userId)) {
      throw new ExpenseValidationError(`user ${s.userId} is not in this group`);
    }
  }
  try {
    return body.splitType === 'EXACT'
      ? splitExact(body.amount, splits)
      : splitPercent(body.amount, splits);
  } catch (err) {
    throw new ExpenseValidationError((err as Error).message);
  }
}

export async function expensesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Create an expense ───────────────────────────────────────────────────────
  app.post(
    '/v1/groups/:id/expenses',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'Add an expense to a group',
        description:
          'Records who paid and how the cost is split (EQUAL / EXACT / PERCENT). Amounts are integer paise; shares always sum exactly to the total.',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        body: CreateExpenseSchema,
        response: {
          201: ExpenseSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          422: ApiErrorSchema,
        },
      },
    },
    async (req, reply) => {
      await assertMember(req.params.id, req.userId);

      const members = await prisma.groupMember.findMany({
        where: { groupId: req.params.id },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m) => m.userId));

      const paidById = req.body.paidById ?? req.userId;
      if (!memberIds.has(paidById)) {
        return reply
          .status(422)
          .send({ error: { code: 'INVALID_EXPENSE', message: 'payer is not in this group' } });
      }

      const shares = buildShares(req.body, memberIds);

      const expense = await prisma.expense.create({
        data: {
          groupId: req.params.id,
          description: req.body.description,
          amount: req.body.amount,
          splitType: req.body.splitType,
          paidById,
          createdById: req.userId,
          splits: {
            create: [...shares.entries()].map(([userId, amount]) => ({ userId, amount })),
          },
        },
        include: { splits: true },
      });

      await fireExpenseNotification(req.params.id, req.userId, expense, false);

      reply.status(201);
      return serializeExpense(expense);
    },
  );

  // ── List a group's expenses ─────────────────────────────────────────────────
  app.get(
    '/v1/groups/:id/expenses',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'List a group’s expenses (newest first)',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        response: { 200: z.array(ExpenseSchema), 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req) => {
      await assertMember(req.params.id, req.userId);
      const expenses = await prisma.expense.findMany({
        where: { groupId: req.params.id, deletedAt: null },
        include: { splits: true },
        orderBy: { createdAt: 'desc' },
      });
      return expenses.map(serializeExpense);
    },
  );

  // ── Update an expense ───────────────────────────────────────────────────────
  app.patch(
    '/v1/expenses/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'Update an expense',
        description:
          'Replaces an expense’s description, amount, and split. Splits are recomputed and swapped atomically; the payer defaults to the existing one.',
        security: [{ bearerAuth: [] }],
        params: ExpenseIdParam,
        body: UpdateExpenseSchema,
        response: {
          200: ExpenseSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          422: ApiErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const existing = await prisma.expense.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { groupId: true, paidById: true },
      });
      if (!existing) {
        return reply
          .status(404)
          .send({ error: { code: 'EXPENSE_NOT_FOUND', message: 'expense not found' } });
      }
      await assertMember(existing.groupId, req.userId);

      const members = await prisma.groupMember.findMany({
        where: { groupId: existing.groupId },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((m) => m.userId));

      const paidById = req.body.paidById ?? existing.paidById;
      if (!memberIds.has(paidById)) {
        return reply
          .status(422)
          .send({ error: { code: 'INVALID_EXPENSE', message: 'payer is not in this group' } });
      }

      const shares = buildShares(req.body, memberIds);

      // Swap splits atomically so balances never observe a partial update.
      const updated = await prisma.$transaction(async (tx) => {
        await tx.expenseSplit.deleteMany({ where: { expenseId: req.params.id } });
        return tx.expense.update({
          where: { id: req.params.id },
          data: {
            description: req.body.description,
            amount: req.body.amount,
            splitType: req.body.splitType,
            paidById,
            splits: {
              create: [...shares.entries()].map(([userId, amount]) => ({ userId, amount })),
            },
          },
          include: { splits: true },
        });
      });

      await fireExpenseNotification(existing.groupId, req.userId, updated, true);

      return serializeExpense(updated);
    },
  );

  // ── Delete (soft) an expense ────────────────────────────────────────────────
  app.delete(
    '/v1/expenses/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'Delete an expense',
        description: 'Soft-deletes the expense so it drops out of balances but stays auditable.',
        security: [{ bearerAuth: [] }],
        params: ExpenseIdParam,
        response: { 204: z.null(), 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req, reply) => {
      const expense = await prisma.expense.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { groupId: true },
      });
      if (!expense) {
        return reply
          .status(404)
          .send({ error: { code: 'EXPENSE_NOT_FOUND', message: 'expense not found' } });
      }
      await assertMember(expense.groupId, req.userId);
      await prisma.expense.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });
      return reply.status(204).send(null);
    },
  );
}

type ExpenseWithSplits = Prisma.ExpenseGetPayload<{ include: { splits: true } }>;

function serializeExpense(e: ExpenseWithSplits) {
  return {
    id: e.id,
    groupId: e.groupId,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    splitType: e.splitType,
    paidById: e.paidById,
    createdById: e.createdById,
    createdAt: e.createdAt.toISOString(),
    splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
  };
}
