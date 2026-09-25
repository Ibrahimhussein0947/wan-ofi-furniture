import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const STREAM_URL = `${import.meta.env.VITE_API_URL || ''}/api/events/stream`;

// Which cached data to refresh for each kind of live event.
const INVALIDATE = {
  notification: [['unread'], ['notifications'], ['dashboard']],
  message: [['unread'], ['conversations'], ['thread']],
};

/**
 * Subscribes to server-sent events so notifications and messages appear instantly.
 * Periodic polling stays in place as a fallback if the stream is unavailable.
 */
export default function useLiveEvents() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || typeof window.EventSource === 'undefined') return undefined;
    let source;
    let retry;
    let stopped = false;
    let attempts = 0;

    const connect = async () => {
      try {
        // Tickets are single use, so every (re)connection fetches a fresh one.
        const { ticket } = await eventsApi.ticket();
        if (stopped) return;
        source = new EventSource(`${STREAM_URL}?ticket=${ticket}`);
        source.addEventListener('open', () => {
          attempts = 0;
        });
        source.addEventListener('update', (e) => {
          let event = {};
          try {
            event = JSON.parse(e.data);
          } catch {
            return;
          }
          (INVALIDATE[event.kind] || []).forEach((queryKey) => qc.invalidateQueries({ queryKey }));
        });
        source.onerror = () => {
          source.close();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempts += 1;
      retry = setTimeout(connect, Math.min(30000, 2000 * 2 ** Math.min(attempts, 4)));
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [isAuthenticated, qc]);
}
