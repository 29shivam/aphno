import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '@aphno/db';
import {
  ApiErrorSchema,
  AuthTokenResponseSchema,
  GoogleAuthSchema,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifySchema,
} from '@aphno/shared';
import { env, isProd } from '../../platform/env.js';
import { generateOtp, hashOtp, signJwt, verifyOtp } from '../../platform/crypto.js';
import { deliverOtp } from '../../platform/otp-delivery.js';
import { verifyGoogleIdToken } from '../../platform/google.js';
import { normalizePhone } from '../../platform/phone.js';
import { toUserDto } from '../users/user.dto.js';

export async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Request an OTP ──────────────────────────────────────────────────────────
  app.post(
    '/v1/auth/otp/request',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request a login OTP',
        description:
          'Generates a 6-digit code for the phone number. In non-production the code is returned as `devCode` and logged; in production it would be sent over SMS.',
        body: OtpRequestSchema,
        response: { 200: OtpRequestResponseSchema },
      },
    },
    async (req) => {
      const phone = normalizePhone(req.body.phone);
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + env.OTP_TTL_SEC * 1000);

      const challenge = await prisma.otpChallenge.create({
        data: { phone, codeHash: hashOtp(phone, code), expiresAt },
      });

      // Deliver over WhatsApp (preferred) → SMS → dev-log, per configuration.
      await deliverOtp(phone, code);

      return {
        requestId: challenge.id,
        expiresInSec: env.OTP_TTL_SEC,
        ...(isProd ? {} : { devCode: code }),
      };
    },
  );

  // ── Verify OTP → issue JWT ──────────────────────────────────────────────────
  app.post(
    '/v1/auth/otp/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify an OTP and sign in',
        description:
          'Checks the code against the most recent live challenge. On success, creates the user if new and returns a JWT bearer token.',
        body: OtpVerifySchema,
        response: { 200: AuthTokenResponseSchema, 401: ApiErrorSchema },
      },
    },
    async (req, reply) => {
      const phone = normalizePhone(req.body.phone);

      const challenge = await prisma.otpChallenge.findFirst({
        where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      if (!challenge) {
        return reply
          .status(401)
          .send({ error: { code: 'OTP_EXPIRED', message: 'no active code — request a new one' } });
      }

      if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
        return reply.status(401).send({
          error: { code: 'OTP_LOCKED', message: 'too many attempts — request a new code' },
        });
      }

      if (!verifyOtp(phone, req.body.code, challenge.codeHash)) {
        await prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        return reply
          .status(401)
          .send({ error: { code: 'OTP_INVALID', message: 'incorrect code' } });
      }

      // Consume the challenge and upsert the user atomically.
      // Generous timeouts tolerate serverless (Neon) cold-start latency.
      const user = await prisma.$transaction(
        async (tx) => {
          await tx.otpChallenge.update({
            where: { id: challenge.id },
            data: { consumedAt: new Date() },
          });
          return tx.user.upsert({
            where: { phone },
            create: { phone },
            update: {},
          });
        },
        { maxWait: 5000, timeout: 15000 },
      );

      const token = signJwt({ sub: user.id, phone: user.phone });
      return { token, user: toUserDto(user) };
    },
  );

  // ── Google sign-in ──────────────────────────────────────────────────────────
  app.post(
    '/v1/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with a Google ID token',
        description:
          'Verifies a Google ID token, creates or links the user by Google account / email, and returns a JWT bearer token.',
        body: GoogleAuthSchema,
        response: { 200: AuthTokenResponseSchema, 401: ApiErrorSchema },
      },
    },
    async (req) => {
      const profile = await verifyGoogleIdToken(req.body.idToken);

      // Match by Google id first, then by email; otherwise create.
      const user = await prisma.$transaction(
        async (tx) => {
          const existing =
            (await tx.user.findUnique({ where: { googleId: profile.sub } })) ??
            (await tx.user.findUnique({ where: { email: profile.email } }));

          if (existing) {
            return tx.user.update({
              where: { id: existing.id },
              data: {
                googleId: profile.sub,
                email: profile.email,
                name: existing.name ?? profile.name,
                avatarUrl: existing.avatarUrl ?? profile.picture,
              },
            });
          }

          return tx.user.create({
            data: {
              googleId: profile.sub,
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.picture,
            },
          });
        },
        { maxWait: 5000, timeout: 15000 },
      );

      const token = signJwt({ sub: user.id, phone: user.phone });
      return { token, user: toUserDto(user) };
    },
  );
}
