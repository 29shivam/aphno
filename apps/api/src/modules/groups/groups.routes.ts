import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@aphno/db';
import {
  AddMemberSchema,
  ApiErrorSchema,
  CreateGroupSchema,
  GroupBalancesSchema,
  GroupDetailSchema,
  GroupSchema,
  uuid,
} from '@aphno/shared';
import { normalizePhone } from '../../platform/phone.js';
import { assertMember, findOrCreateUserByPhone } from './group.service.js';
import { computeGroupBalances } from './balance.service.js';

const GroupIdParam = z.object({ id: uuid });

export async function groupsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Create a group ──────────────────────────────────────────────────────────
  app.post(
    '/v1/groups',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        summary: 'Create a group',
        description:
          'Creates a group with the caller as owner. Optional `memberPhones` seed members; unknown numbers become stub users you can invite later.',
        security: [{ bearerAuth: [] }],
        body: CreateGroupSchema,
        response: { 201: GroupDetailSchema },
      },
    },
    async (req, reply) => {
      const group = await prisma.$transaction(
        async (tx) => {
          const g = await tx.group.create({
            data: {
              name: req.body.name,
              createdById: req.userId,
              members: { create: { userId: req.userId, role: 'OWNER' } },
            },
          });

          for (const rawPhone of req.body.memberPhones ?? []) {
            const phone = normalizePhone(rawPhone);
            const u = await findOrCreateUserByPhone(phone, undefined, tx);
            if (u.id === req.userId) continue;
            await tx.groupMember.upsert({
              where: { groupId_userId: { groupId: g.id, userId: u.id } },
              create: { groupId: g.id, userId: u.id, role: 'MEMBER' },
              update: {},
            });
          }
          return g;
        },
        { maxWait: 5000, timeout: 15000 },
      );

      reply.status(201);
      return serializeGroupDetail(group.id);
    },
  );

  // ── List my groups ──────────────────────────────────────────────────────────
  app.get(
    '/v1/groups',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        summary: 'List the groups I belong to',
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(GroupSchema) },
      },
    },
    async (req) => {
      const groups = await prisma.group.findMany({
        where: { members: { some: { userId: req.userId } } },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true } } },
      });
      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        createdById: g.createdById,
        createdAt: g.createdAt.toISOString(),
        memberCount: g._count.members,
      }));
    },
  );

  // ── Group detail (with members) ─────────────────────────────────────────────
  app.get(
    '/v1/groups/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        summary: 'Get a group and its members',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        response: { 200: GroupDetailSchema, 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req) => {
      await assertMember(req.params.id, req.userId);
      return serializeGroupDetail(req.params.id);
    },
  );

  // ── Add a member by phone ───────────────────────────────────────────────────
  app.post(
    '/v1/groups/:id/members',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        summary: 'Add a member to a group',
        description: 'Adds by phone number, creating a stub user if the number is new.',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        body: AddMemberSchema,
        response: { 200: GroupDetailSchema, 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req) => {
      await assertMember(req.params.id, req.userId);
      const phone = normalizePhone(req.body.phone);
      const u = await findOrCreateUserByPhone(phone, req.body.name, prisma);
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: req.params.id, userId: u.id } },
        create: { groupId: req.params.id, userId: u.id, role: 'MEMBER' },
        update: {},
      });
      return serializeGroupDetail(req.params.id);
    },
  );

  // ── Balances & suggested settle-up ──────────────────────────────────────────
  app.get(
    '/v1/groups/:id/balances',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        summary: 'Get net balances and minimal settle-up transfers',
        description:
          'Returns each member’s net position (positive = owed money) plus a minimal set of transfers that would settle the whole group.',
        security: [{ bearerAuth: [] }],
        params: GroupIdParam,
        response: { 200: GroupBalancesSchema, 403: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (req) => {
      await assertMember(req.params.id, req.userId);
      return computeGroupBalances(req.params.id);
    },
  );
}

async function serializeGroupDetail(groupId: string) {
  const g = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
    },
  });
  return {
    id: g.id,
    name: g.name,
    createdById: g.createdById,
    createdAt: g.createdAt.toISOString(),
    memberCount: g.members.length,
    members: g.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      phone: m.user.phone,
      upiId: m.user.upiId,
      role: m.role,
    })),
  };
}
