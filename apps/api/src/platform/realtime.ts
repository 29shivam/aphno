import type { WebSocket } from 'ws';

// In-memory registry of live sockets per user. A user may have several (phone +
// web, multiple tabs). This is single-process — fine for one API instance;
// scaling to many instances would need a pub/sub fan-out (e.g. Redis).
const clients = new Map<string, Set<WebSocket>>();

export function registerSocket(userId: string, socket: WebSocket): void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(socket);
}

export function unregisterSocket(userId: string, socket: WebSocket): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) clients.delete(userId);
}

// Push a JSON event to every live socket for a user. Best-effort: dead sockets
// are ignored (they get cleaned up on close).
export function sendToUser(userId: string, event: unknown): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) {
      try {
        socket.send(payload);
      } catch {
        // ignore transient send failures
      }
    }
  }
}
