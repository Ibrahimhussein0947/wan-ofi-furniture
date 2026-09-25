import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';

const ROLE_PERMISSIONS = {
  OWNER: ['*'],
  ACCOUNTANT: ['payments:read', 'payments:write', 'orders:read', 'orders:write', 'discounts:write', 'refunds:write', 'invoices:write', 'customers:read'],
  WORKER: ['production:read', 'production:update', 'materials:read'],
  CUSTOMER: [],
};

export const makeUser = (role = 'OWNER', extra = {}) => ({
  _id: 'u1',
  name: `Test ${role}`,
  email: `${role.toLowerCase()}@test.com`,
  role,
  workerRole: null,
  effectivePermissions: ROLE_PERMISSIONS[role],
  ...extra,
});

export function authValue(user, overrides = {}) {
  const perms = user?.effectivePermissions || [];
  return {
    user,
    customer: user?.role === 'CUSTOMER' ? { _id: 'c1', name: user.name, address: { street: 'Masaki', city: 'Dar es Salaam' }, phone: '+255700000000' } : null,
    status: user ? 'authenticated' : 'anonymous',
    isAuthenticated: Boolean(user),
    isStaff: Boolean(user && user.role !== 'CUSTOMER'),
    can: (p) => perms.includes('*') || perms.includes(p),
    canAny: (...ps) => perms.includes('*') || ps.some((p) => perms.includes(p)),
    login: async () => user,
    register: async () => user,
    logout: async () => {},
    applySession: async () => {},
    refreshProfile: async () => {},
    setUser: () => {},
    ...overrides,
  };
}

/** Renders a component with router, query client, cart and a fake auth context. */
export function renderWithProviders(ui, { route = '/', path = '*', user = null, auth = {}, extraRoutes = null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = authValue(user, auth);
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>
        <CartProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              {extraRoutes}
            </Routes>
          </MemoryRouter>
        </CartProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return { ...result, auth: value, queryClient };
}
