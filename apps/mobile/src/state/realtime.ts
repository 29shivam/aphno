import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth as tokenStore, wsUrl } from '../api/client';

// Keeps a live WebSocket to the API while `enabled`. On each pushed notification
// it invalidates the feed + notifications queries so the UI refetches — the
// server stays the source of truth; the socket is just a "something changed"
// nudge. Reconnects with exponential backoff.
export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = tokenStore.token;
      if (!token || closed) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
          if (msg.type === 'ready') {
            retryRef.current = 0;
          } else if (msg.type === 'notification') {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['feed'] });
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, [enabled, qc]);
}
