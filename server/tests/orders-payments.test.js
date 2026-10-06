const { api, createUser, createCatalog, models, submitPayment } = require('./helpers');

describe('orders and payments', () => {
  let owner;
  let accountant;
  let customer;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    accountant = await createUser('ACCOUNTANT');
    customer = await createUser('CUSTOMER');
    await models.Setting.create({ key: 'global', depositPercent: 40, defaultDeliveryFee: 0 });
  });

  async function placeOrder(productOpts, quantity = 1, extra = {}) {
    const catalog = await createCatalog(productOpts);
    const res = await api(customer.token).post('/api/orders', {
      items: [{ product: String(catalog.product._id), quantity, color: 'Grey' }],
      deliveryMethod: 'DELIVERY',
      deliveryAddress: { city: 'Addis Ababa' },
      ...extra,
    });
    return { res, ...catalog };
  }

  test('prices come from the database, not the client', async () => {
    const { product } = await createCatalog({ sellingPrice: 50000 });
    // Client-supplied prices, discounts and payment fields are ignored.
    const res = await api(customer.token).post('/api/orders', {
      items: [{ product: String(product._id), quantity: 2, unitPrice: 1 }],
      discount: 49000,
      amountPaid: 100000,
      status: 'COMPLETED',
    });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.subtotal).toBe(100000);
    expect(order.discount).toBe(0);
    expect(order.total).toBe(100000);
    expect(order.balance).toBe(100000);
    expect(order.depositRequired).toBe(40000);
    expect(order.status).toBe('PENDING');
    expect(order.orderNumber).toMatch(/^WO-\d{4}-\d{4}$/);
  });

  test('unavailable colours and unavailable products are rejected', async () => {
    const { product } = await createCatalog();
    const badColor = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1, color: 'Pink' }] });
    expect(badColor.status).toBe(400);
    await models.Product.updateOne({ _id: product._id }, { status: 'DISCONTINUED' });
    const gone = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }] });
    expect(gone.status).toBe(422);
    expect(gone.body.message).toMatch(/Product is unavailable/);
  });

  test('stock-only products cannot be over-ordered', async () => {
    const { res } = await placeOrder({ quantity: 1, madeToOrder: false }, 3);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Insufficient inventory/);
  });

  test('deposit auto-confirms the order, deducts stock and books the sale', async () => {
    const { res, product } = await placeOrder({ quantity: 5 }, 2);
    const orderId = res.body.data._id;

    const deposit = await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 40000, method: 'MOBILE_PAYMENT', reference: 'MP123' });
    expect(deposit.status).toBe(201);
    expect(deposit.body.data.order).toMatchObject({ amountPaid: 40000, balance: 60000, paymentStatus: 'PARTIAL' });

    const order = await models.Order.findById(orderId);
    // In-stock items ship from stock, so the order is ready immediately.
    expect(order.status).toBe('READY');
    expect(order.items[0].stockDeducted).toBe(true);
    expect((await models.Product.findById(product._id)).quantity).toBe(3);
    expect(await models.InventoryTransaction.countDocuments({ product: product._id, type: 'SALE', quantity: -2 })).toBe(1);
    expect(await models.FinancialTransaction.countDocuments({ order: orderId, type: 'SALE' })).toBe(1);
    expect(await models.FinancialTransaction.countDocuments({ order: orderId, type: 'CUSTOMER_PAYMENT', direction: 'IN' })).toBe(1);

    const payment = await models.Payment.findOne({ order: orderId });
    expect(payment.kind).toBe('DEPOSIT');
    expect(payment.receiptNumber).toMatch(/^RCT-/);
    expect(await models.AuditLog.countDocuments({ action: 'PAYMENT', reference: order.orderNumber })).toBe(1);
  });

  test('payments cannot exceed the remaining balance', async () => {
    const { res } = await placeOrder({}, 1);
    const orderId = res.body.data._id;
    const over = await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 50001, method: 'CASH' });
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/Payment exceeds remaining balance/);

    const full = await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 50000, method: 'CASH' });
    expect(full.body.data.order).toMatchObject({ balance: 0, paymentStatus: 'PAID' });
    const again = await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 1, method: 'CASH' });
    expect(again.status).toBe(400);
  });

  test('made-to-order items create production jobs with BOM materials', async () => {
    const { res, wood } = await placeOrder({ quantity: 0 }, 2);
    const orderId = res.body.data._id;
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 40000, method: 'CASH' });
    const order = await models.Order.findById(orderId);
    expect(order.status).toBe('CONFIRMED');
    const job = await models.ProductionJob.findOne({ order: orderId });
    expect(job.stage).toBe('PENDING');
    const woodLine = job.requiredMaterials.find((m) => String(m.material) === String(wood._id));
    expect(woodLine.quantityRequired).toBe(40);
    expect(order.items[0].productionJob.toString()).toBe(job._id.toString());
  });

  test('discounts recalculate totals and never drop below what was paid', async () => {
    const { res } = await placeOrder({}, 2);
    const orderId = res.body.data._id;
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 60000, method: 'CASH' });

    const ok = await api(accountant.token).post(`/api/orders/${orderId}/discount`, { discount: 10000, reason: 'Loyal customer' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ total: 90000, balance: 30000 });

    const tooMuch = await api(accountant.token).post(`/api/orders/${orderId}/discount`, { discount: 50000, reason: 'Too generous' });
    expect(tooMuch.status).toBe(400);
    expect((await api(customer.token).post(`/api/orders/${orderId}/discount`, { discount: 1, reason: 'please' })).status).toBe(403);
  });

  test('customers can cancel pending orders; nobody can cancel after production started', async () => {
    const pending = await placeOrder({}, 1);
    const cancel = await api(customer.token).post(`/api/orders/${pending.res.body.data._id}/cancel`, { reason: 'Changed my mind' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');

    const { res } = await placeOrder({ quantity: 0 }, 1);
    const orderId = res.body.data._id;
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 20000, method: 'CASH' });
    const job = await models.ProductionJob.findOne({ order: orderId });
    await api(owner.token).post(`/api/production/${job._id}/issue-materials`, {});
    await api(owner.token).post(`/api/production/${job._id}/stage`, { stage: 'IN_PRODUCTION' });

    const blocked = await api(owner.token).post(`/api/orders/${orderId}/cancel`, { reason: 'Customer request' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toBe('Order cannot be cancelled after production has started.');
  });

  test('cancelling a confirmed stock order returns stock; refunds reduce amount paid', async () => {
    const { res, product } = await placeOrder({ quantity: 4 }, 1);
    const orderId = res.body.data._id;
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 20000, method: 'CASH' });
    expect((await models.Product.findById(product._id)).quantity).toBe(3);

    await api(owner.token).post(`/api/orders/${orderId}/cancel`, { reason: 'Out of delivery area' });
    expect((await models.Product.findById(product._id)).quantity).toBe(4);
    expect(await models.InventoryTransaction.countDocuments({ product: product._id, type: 'RETURN' })).toBe(1);

    const tooBig = await api(accountant.token).post('/api/payments/refund', { order: orderId, amount: 25000, method: 'CASH', reason: 'Order cancelled' });
    expect(tooBig.status).toBe(400);
    const refund = await api(accountant.token).post('/api/payments/refund', { order: orderId, amount: 20000, method: 'CASH', reason: 'Order cancelled' });
    expect(refund.status).toBe(201);
    const order = await models.Order.findById(orderId);
    expect(order).toMatchObject({ amountPaid: 0, balance: 0, paymentStatus: 'REFUNDED' });
    expect(await models.FinancialTransaction.countDocuments({ order: orderId, type: 'REFUND', direction: 'OUT' })).toBe(1);
  });

  test('customer-submitted payments only count after verification', async () => {
    const { res } = await placeOrder({ quantity: 0 }, 1);
    const orderId = res.body.data._id;
    const submitted = await submitPayment(customer.token, { order: orderId, amount: 20000, method: 'BANK_TRANSFER', reference: 'BT-99' });
    expect(submitted.status).toBe(201);
    expect((await models.Order.findById(orderId)).amountPaid).toBe(0);

    const verified = await api(accountant.token).post(`/api/payments/${submitted.body.data._id}/verify`, { approve: true });
    expect(verified.status).toBe(200);
    const order = await models.Order.findById(orderId);
    expect(order.amountPaid).toBe(20000);
    expect(order.status).toBe('CONFIRMED');
  });

  test('invoices mirror the order balance', async () => {
    const { res } = await placeOrder({}, 1);
    const orderId = res.body.data._id;
    const invoice = await api(accountant.token).post('/api/invoices', { order: orderId });
    expect(invoice.status).toBe(201);
    expect(invoice.body.data.balance).toBe(50000);
    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 30000, method: 'CASH' });
    const updated = await models.Invoice.findById(invoice.body.data._id);
    expect(updated).toMatchObject({ amountPaid: 30000, balance: 20000, status: 'PARTIALLY_PAID' });

    const view = await api(customer.token).get(`/api/invoices/${invoice.body.data._id}`);
    expect(view.status).toBe(200);
    expect(view.body.data.payments).toHaveLength(1);
  });

  test('customer debt shows on the customer profile', async () => {
    const res = await api(accountant.token).get(`/api/customers/${customer.customer._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.balance).toBeGreaterThan(0);
    const debts = await api(accountant.token).get('/api/reports/customer-debts');
    expect(debts.body.data.rows.find((r) => String(r.customerId) === String(customer.customer._id)).balance).toBe(res.body.data.summary.balance);
  });
});
