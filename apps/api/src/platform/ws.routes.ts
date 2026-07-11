import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyJwt } from './crypto.js';
import { registerSocket, unregisterSocket } from './realtime.js';

const AUTH_TIMEOUT_MS = 10_000;

// Real-time channel. The client opens the socket, then sends
// `{ type: "auth", token: "<jwt>" }` as its first message. We verify it,
// register the socket for that user, and reply `{ type: "ready" }`. The server
// then pushes `{ type: "notification", notification }` events via sendToUser.
export async function wsRoutes(app: FastifyInstance) {
  app.get('/v1/ws', { websocket: true }, (socket: WebSocket) => {
    let userId: string | null = null;

    const timeout = setTimeout(() => {
      if (!userId) socket.close(4001, 'auth timeout');
    }, AUTH_TIMEOUT_MS);

    socket.on('message', (raw: Buffer) => {
      if (userId) return; // already authenticated; ignore further client messages
      let payloadSub: string | null = null;
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: unknown };
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          payloadSub = verifyJwt(msg.token)?.sub ?? null;
        }
      } catch {
        // fall through to auth failure
      }
      if (!payloadSub) {
        socket.send(JSON.stringify({ type: 'error', message: 'auth required' }));
        socket.close(4001, 'unauthorized');
        return;
      }
      userId = payloadSub;
      clearTimeout(timeout);
      registerSocket(userId, socket);
      socket.send(JSON.stringify({ type: 'ready' }));
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      if (userId) unregisterSocket(userId, socket);
    });
    socket.on('error', () => {
      if (userId) unregisterSocket(userId, socket);
    });
  });
}
