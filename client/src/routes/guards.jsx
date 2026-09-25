import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth, homePathFor } from '../context/AuthContext';
import { PageLoader, EmptyState } from '../components/ui/States';
import Button from '../components/ui/Button';

/** Requires a logged-in user, optionally with one of `roles`. */
export function ProtectedRoute({ roles }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

/** Hides pages the user lacks permission for (the API refuses them anyway). */
export function RequirePermission({ perms, children }) {
  const { canAny } = useAuth();
  if (perms && !canAny(...perms)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="You do not have permission to view this page"
        message="Ask the owner if you need access."
        action={<Button to="/app">Back to dashboard</Button>}
      />
    );
  }
  return children;
}

export function GuestOnly() {
  const { status, user } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}
