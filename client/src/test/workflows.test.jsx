import { describe, expect, test, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { renderWithProviders, makeUser } from './utils';

vi.mock('../api/endpoints', () => ({
  ordersApi: { create: vi.fn(), list: vi.fn() },
  paymentsApi: { customer: vi.fn() },
  productionApi: { get: vi.fn(), action: vi.fn() },
  productsApi: { create: vi.fn(), update: vi.fn(), get: vi.fn(), list: vi.fn() },
  categoriesApi: { list: vi.fn() },
  materialsApi: { list: vi.fn() },
  workersApi: { list: vi.fn() },
  tasksApi: { update: vi.fn(), create: vi.fn() },
  publicApi: { settings: vi.fn() },
}));

import { ordersApi, paymentsApi, productionApi, productsApi, categoriesApi, publicApi } from '../api/endpoints';
import Checkout from '../pages/public/Checkout';
import JobDetail from '../pages/staff/production/JobDetail';
import ProductForm from '../pages/staff/catalog/ProductForm';
import { CustomerPaymentModal } from '../components/finance/PaymentModals';

beforeEach(() => {
  publicApi.settings.mockResolvedValue({ currency: 'TZS', depositPercent: 40, defaultDeliveryFee: 0 });
});

describe('Customer workflow: checkout', () => {
  test('places an order from the cart with database prices', async () => {
    localStorage.setItem('wanofi.cart', JSON.stringify([{ productId: 'p1', slug: 'pemba', name: 'Pemba Accent Chair', price: 450000, color: 'Teal', quantity: 2 }]));
    ordersApi.create.mockResolvedValue({ _id: 'o1', orderNumber: 'WO-2026-0100' });
    renderWithProviders(<Checkout />, {
      route: '/checkout',
      path: '/checkout',
      user: makeUser('CUSTOMER'),
      extraRoutes: [<Route key="o" path="/account/orders/:id" element={<p>Order page</p>} />],
    });

    expect(screen.getAllByText('TZS 900,000', { selector: 'dd' })).toHaveLength(2); // subtotal and total
    expect(await screen.findByText('TZS 360,000')).toBeInTheDocument(); // 40% deposit
    await userEvent.click(screen.getByRole('button', { name: /collect from showroom/i }));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => expect(ordersApi.create).toHaveBeenCalled());
    const body = ordersApi.create.mock.calls[0][0];
    expect(body).toMatchObject({ deliveryMethod: 'PICKUP', items: [{ product: 'p1', quantity: 2, color: 'Teal' }] });
    // Prices are never sent — the server decides them.
    expect(body.items[0].price).toBeUndefined();
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('wanofi.cart'))).toEqual([]);
  });
});

describe('Accountant workflow: recording a payment', () => {
  const order = { _id: 'o1', orderNumber: 'WO-2026-0071', total: 450000, amountPaid: 180000, balance: 270000 };

  test('rejects payments above the remaining balance', async () => {
    renderWithProviders(<CustomerPaymentModal open onClose={() => {}} order={order} />, { user: makeUser('ACCOUNTANT') });
    const amount = screen.getByLabelText(/amount/i);
    await userEvent.clear(amount);
    await userEvent.type(amount, '300000');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));
    expect(await screen.findByText(/Payment exceeds remaining balance/)).toBeInTheDocument();
    expect(paymentsApi.customer).not.toHaveBeenCalled();
  });

  test('records a valid payment', async () => {
    paymentsApi.customer.mockResolvedValue({ payment: {}, order: { ...order, balance: 0 } });
    const onClose = vi.fn();
    renderWithProviders(<CustomerPaymentModal open onClose={onClose} order={order} />, { user: makeUser('ACCOUNTANT') });
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'MOBILE_PAYMENT');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));
    await waitFor(() => expect(paymentsApi.customer).toHaveBeenCalled());
    expect(paymentsApi.customer.mock.calls[0][0]).toMatchObject({ order: 'o1', amount: 270000, method: 'MOBILE_PAYMENT' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('Worker workflow: updating production', () => {
  const job = {
    _id: 'j1',
    jobNumber: 'PJ-2026-0035',
    title: 'Pemba Accent Chair × 1',
    stage: 'MATERIALS_READY',
    progress: 20,
    priority: 'NORMAL',
    quantity: 1,
    specifications: { color: 'Mustard' },
    order: { orderNumber: 'WO-2026-0071' },
    customer: { name: 'Amina Hassan' },
    product: { name: 'Pemba Accent Chair' },
    assignedWorkers: [{ _id: 'u1', name: 'Test WORKER', workerRole: 'CARPENTER' }],
    requiredMaterials: [{ material: { _id: 'm1', name: 'Mahogany', unit: 'piece', quantity: 50 }, quantityRequired: 3, quantityIssued: 3, quantityReturned: 0 }],
    materialRequests: [],
    problems: [],
    notes: [],
    images: [],
    stageHistory: [],
    qualityChecks: [],
    tasks: [],
  };

  test('a carpenter sees only permitted stage buttons and can start production', async () => {
    productionApi.get.mockResolvedValue(job);
    productionApi.action.mockResolvedValue({ ...job, stage: 'IN_PRODUCTION' });
    renderWithProviders(<JobDetail />, { route: '/app/production/j1', path: '/app/production/:id', user: makeUser('WORKER', { workerRole: 'CARPENTER' }) });

    const start = await screen.findByRole('button', { name: /^in production/i });
    expect(screen.queryByRole('button', { name: /^cancelled/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report problem/i })).toBeInTheDocument();
    await userEvent.click(start);
    await waitFor(() => expect(productionApi.action).toHaveBeenCalledWith('j1', 'stage', { stage: 'IN_PRODUCTION' }));
  });

  test('production cannot start while materials are outstanding', async () => {
    productionApi.get.mockResolvedValue({ ...job, requiredMaterials: [{ ...job.requiredMaterials[0], quantityIssued: 1 }] });
    renderWithProviders(<JobDetail />, { route: '/app/production/j1', path: '/app/production/:id', user: makeUser('WORKER', { workerRole: 'CARPENTER' }) });
    expect(await screen.findByRole('button', { name: /^in production/i })).toBeDisabled();
    expect(screen.getByText(/once all materials are issued/)).toBeInTheDocument();
  });
});

describe('Owner workflow: product creation', () => {
  test('creates a product with parsed lists and opening stock', async () => {
    categoriesApi.list.mockResolvedValue({ items: [{ _id: 'cat1', name: 'Chairs' }] });
    productsApi.create.mockResolvedValue({ _id: 'p9' });
    renderWithProviders(<ProductForm />, {
      route: '/app/products/new',
      path: '/app/products/new',
      user: makeUser('OWNER'),
      extraRoutes: [<Route key="p" path="/app/products/:id" element={<p>Saved</p>} />],
    });
    await userEvent.type(screen.getByLabelText(/^name/i), 'Lindi Stool');
    await userEvent.type(screen.getByLabelText(/^sku/i), 'chr-lin');
    await screen.findByRole('option', { name: 'Chairs' });
    await userEvent.selectOptions(screen.getByLabelText(/^category/i), 'cat1');
    await userEvent.type(screen.getByLabelText(/list price/i), '120000');
    await userEvent.type(screen.getByLabelText(/cost price/i), '60000');
    await userEvent.type(screen.getByLabelText(/selling price/i), '110000');
    await userEvent.type(screen.getByLabelText(/^colours/i), 'Natural, Walnut');
    const stock = screen.getByLabelText(/opening stock/i);
    await userEvent.clear(stock);
    await userEvent.type(stock, '4');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(productsApi.create).toHaveBeenCalled());
    const [body] = productsApi.create.mock.calls[0];
    expect(body).toMatchObject({ name: 'Lindi Stool', sku: 'CHR-LIN', category: 'cat1', sellingPrice: 110000, colors: ['Natural', 'Walnut'], quantity: 4 });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  test('warns when the selling price is below cost', async () => {
    categoriesApi.list.mockResolvedValue({ items: [{ _id: 'cat1', name: 'Chairs' }] });
    renderWithProviders(<ProductForm />, { route: '/app/products/new', path: '/app/products/new', user: makeUser('OWNER') });
    await userEvent.type(screen.getByLabelText(/cost price/i), '60000');
    await userEvent.type(screen.getByLabelText(/selling price/i), '50000');
    expect(within(screen.getByText(/margin per unit/i)).getByText(/-TZS|TZS -/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));
    expect(await screen.findByText(/Selling price is below cost/)).toBeInTheDocument();
    expect(productsApi.create).not.toHaveBeenCalled();
  });
});
