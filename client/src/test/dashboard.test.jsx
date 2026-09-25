import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import OwnerDashboard from '../pages/staff/dashboards/OwnerDashboard';
import WorkerDashboard from '../pages/staff/dashboards/WorkerDashboard';
import { renderWithProviders, makeUser } from './utils';
import { setCurrency } from '../utils/format';

const ownerData = {
  role: 'OWNER',
  kpis: {
    totalSales: 87100000,
    todaySales: 450000,
    todayOrders: 1,
    monthlySales: 11200000,
    monthlyOrders: 5,
    totalExpenses: 70800000,
    netProfit: 7016913,
    monthProfit: 5400000,
    monthExpenses: 2300000,
    pendingOrders: 2,
    activeOrders: 6,
    completedOrders: 61,
    activeProductionJobs: 3,
    delayedJobs: 2,
    lowStockMaterials: 5,
    customerDebt: 10110000,
    debtorCustomers: 7,
    supplierDebt: 8489000,
    customers: 8,
    workers: 9,
    pendingApprovals: 1,
    pendingCustomRequests: 1,
  },
  productionStatus: [{ stage: 'IN_PRODUCTION', count: 2 }],
  lowStock: [{ _id: 'm1', name: 'Genuine Leather', quantity: 6, minStock: 10, unit: 'meter' }],
  recentTransactions: [{ _id: 't1', description: 'deposit payment for WO-2026-0071', type: 'CUSTOMER_PAYMENT', direction: 'IN', amount: 180000, date: new Date().toISOString() }],
  recentOrders: [{ _id: 'o1', orderNumber: 'WO-2026-0071', orderDate: new Date().toISOString(), total: 450000, status: 'CONFIRMED', customer: { name: 'Amina Hassan' } }],
  revenueSeries: [{ period: '2026-09', income: 1, expenses: 1, profit: 0, sales: 1, orders: 1 }],
  expenseByCategory: [{ category: 'RENT', amount: 1500000 }],
  salesTrend: [{ date: '2026-09-24', sales: 450000, orders: 1 }],
};

describe('Owner dashboard', () => {
  test('shows the key business figures and alerts', () => {
    setCurrency('TZS');
    renderWithProviders(<OwnerDashboard data={ownerData} />, { user: makeUser('OWNER') });
    expect(screen.getByText('TZS 87.1M')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    expect(screen.getByText(/1 expense\(s\) awaiting your approval/)).toBeInTheDocument();
    expect(screen.getByText(/5 material\(s\) low on stock/)).toBeInTheDocument();
    expect(screen.getByText('WO-2026-0071')).toBeInTheDocument();
    expect(screen.getByText('Genuine Leather')).toBeInTheDocument();
    expect(screen.getByText('+TZS 180,000')).toBeInTheDocument();
  });
});

describe('Worker dashboard', () => {
  test('lists assigned jobs with due dates and open problems', () => {
    renderWithProviders(
      <WorkerDashboard
        data={{
          kpis: { assignedJobs: 1, dueSoon: 0, overdue: 1, openTasks: 0, readyForDelivery: 0, deliveries: 0 },
          jobs: [{ _id: 'j1', jobNumber: 'PJ-2026-0035', title: 'Pemba Accent Chair × 1', stage: 'IN_PRODUCTION', progress: 40, priority: 'NORMAL', openProblems: 1, expectedCompletionDate: new Date(Date.now() - 2 * 86400000).toISOString(), order: { orderNumber: 'WO-2026-0071' } }],
          tasks: [],
          materialNeeds: [],
          deliveries: [],
          notifications: [],
        }}
      />,
      { user: makeUser('WORKER', { workerRole: 'UPHOLSTERER' }) }
    );
    expect(screen.getByText('Pemba Accent Chair × 1')).toBeInTheDocument();
    expect(screen.getByText(/overdue/)).toBeInTheDocument();
    expect(screen.getByText('1 open problem(s)')).toBeInTheDocument();
    // Regular workers don't see the production board button.
    expect(screen.queryByText('Production board')).not.toBeInTheDocument();
  });
});
