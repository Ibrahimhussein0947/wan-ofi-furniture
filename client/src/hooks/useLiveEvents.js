import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const STREAM_URL = `${import.meta.env.VITE_API_URL || ''}/api/events/stream`;

// Which cached data to refresh for each kind of live event.
// Business lists that change when customers or colleagues act (orders, payments, ...). A
// notification usually means one of them changed, so they are refreshed along with it.
const BUSINESS_DATA = [
  ['orders'],
  ['order'],
  ['payments'],
  ['payment'],
  ['customers'],
  ['customer'],
  ['invoices'],
  ['invoice'],
  ['production'],
  ['job'],
  ['deliveries'],
  ['delivery'],
  ['custom-orders'],
  ['custom-order'],
  ['inventory'],
  ['quality'],
  ['tasks'],
];
const INVALIDATE = {
  notification: [['unread'], ['notifications'], ['dashboard'], ...BUSINESS_DATA],
  message: [['unread'], ['conversations'], ['thread']],
};
// Without a working live stream (some proxies buffer it) the lists are re-checked this often.
const FALLBACK_REFRESH_MS = 20 * 1000;

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
    let streaming = false;
    // Keeps lists fresh while the stream is down; the tab must be visible so idle tabs stay quiet.
    const poll = setInterval(() => {
      if (streaming || document.visibilityState !== 'visible') return;
      [['unread'], ['dashboard'], ...BUSINESS_DATA].forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    }, FALLBACK_REFRESH_MS);

    const connect = async () => {
      try {
        // Tickets are single use, so every (re)connection fetches a fresh one.
        const { ticket } = await eventsApi.ticket();
        if (stopped) return;
        source = new EventSource(`${STREAM_URL}?ticket=${ticket}`);
        source.addEventListener('open', () => {
          attempts = 0;
          streaming = true;
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
          streaming = false;
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
      clearInterval(poll);
      clearTimeout(retry);
      source?.close();
    };
  }, [isAuthenticated, qc]);
}
