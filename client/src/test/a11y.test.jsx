import { describe, expect, test, vi } from 'vitest';
import axe from 'axe-core';
import { screen } from '@testing-library/react';
import { renderWithProviders, makeUser } from './utils';

vi.mock('../api/endpoints', () => ({
  publicApi: { settings: vi.fn().mockResolvedValue({ currency: 'ETB', taxRate: 15, depositPercent: 40, onlinePayments: true, mobileNetworks: ['TELEBIRR', 'CBE_BIRR'] }) },
  authApi: { forgotPassword: vi.fn(), resetPassword: vi.fn(), resendVerification: vi.fn() },
  ordersApi: { create: vi.fn() },
  paymentsApi: { mobile: vi.fn(), mobileStatus: vi.fn(), submit: vi.fn() },
  branchesApi: { list: vi.fn().mockResolvedValue([]) },
}));

import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Checkout from '../pages/public/Checkout';
import Contact from '../pages/public/Contact';
import PayModal from '../pages/account/PayModal';
import OwnerDashboard from '../pages/staff/dashboards/OwnerDashboard';

/**
 * Runs axe against the rendered page. Colour contrast is excluded because jsdom
 * cannot compute styles; everything else (labels, roles, names, ARIA) is checked.
 */
async function expectNoViolations(container) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

const dashboardData = {
  kpis: { totalSales: 1, todaySales: 0, todayOrders: 0, monthlySales: 0, totalExpenses: 0, netProfit: 0, monthProfit: 0, monthExpenses: 0, pendingOrders: 0, activeOrders: 0, completedOrders: 0, activeProductionJobs: 0, delayedJobs: 0, lowStockMaterials: 0, customerDebt: 0, debtorCustomers: 0, supplierDebt: 0, customers: 0, workers: 0, pendingApprovals: 0, pendingCustomRequests: 0 },
  productionStatus: [],
  lowStock: [],
  recentTransactions: [],
  recentOrders: [],
  revenueSeries: [],
  expenseByCategory: [],
  salesTrend: [],
};

describe('accessibility (axe)', () => {
  test('login form', async () => {
    const { container } = renderWithProviders(<Login />);
    await expectNoViolations(container);
  });

  test('registration form', async () => {
    const { container } = renderWithProviders(<Register />);
    await expectNoViolations(container);
  });

  test('forgot password', async () => {
    const { container } = renderWithProviders(<ForgotPassword />);
    await expectNoViolations(container);
  });

  test('contact form', async () => {
    const { container } = renderWithProviders(<Contact />);
    await expectNoViolations(container);
  });

  test('checkout', async () => {
    localStorage.setItem('wanofi.cart', JSON.stringify([{ productId: 'p1', name: 'Chair', price: 1000, quantity: 1 }]));
    const { container } = renderWithProviders(<Checkout />, { user: makeUser('CUSTOMER') });
    await screen.findByText('VAT (15%)');
    await expectNoViolations(container);
  });

  test('payment dialog', async () => {
    renderWithProviders(<PayModal open onClose={() => {}} order={{ _id: 'o1', balance: 1000, depositRequired: 400, amountPaid: 0, status: 'PENDING' }} />, { user: makeUser('CUSTOMER') });
    await screen.findByText('Mobile money');
    await expectNoViolations(document.body);
  });

  test('owner dashboard', async () => {
    const { container } = renderWithProviders(<OwnerDashboard data={dashboardData} />, { user: makeUser('OWNER') });
    await expectNoViolations(container);
  });
});
