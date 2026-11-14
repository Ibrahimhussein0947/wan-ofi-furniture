import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeSystemOff, isSystemOff } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Replaces the whole app with a vague error while the super admin has the system switched off.
 * /login stays reachable so the super admin can sign in and turn it back on.
 */
export default function SystemOffScreen({ children }) {
  const off = useSyncExternalStore(subscribeSystemOff, isSystemOff);
  const { pathname } = useLocation();
  const { status, user } = useAuth();
  // Wait for the session check first, and never block the super admin (a 503 can arrive after their session is restored).
  if (!off || status === 'loading' || user?.role === 'SUPER_ADMIN' || pathname === '/login') return children;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
      <p className="font-display text-6xl font-semibold text-walnut-800">:(</p>
      <h1 className="mt-4 text-2xl font-semibold text-stone-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-stone-600">Please try again later.</p>
      <button type="button" className="btn-secondary mt-6" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  );
}
