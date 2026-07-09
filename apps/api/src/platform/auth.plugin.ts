import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyJwt } from './crypto.js';

// Augment Fastify with the auth context + guard.
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userPhone: string;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', '');
  app.decorateRequest('userPhone', '');

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'missing bearer token' },
      });
    }
    const payload = verifyJwt(header.slice('Bearer '.length).trim());
    if (!payload) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'invalid or expired token' },
      });
    }
    req.userId = payload.sub;
    req.userPhone = payload.phone;
  });
}

export default fp(authPlugin, { name: 'auth' });
