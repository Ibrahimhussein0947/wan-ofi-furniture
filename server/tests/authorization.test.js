const { api, createUser, createCatalog, models } = require('./helpers');

describe('authorization (enforced on the backend)', () => {
  let owner;
  let accountant;
  let carpenter;
  let customer;
  let otherCustomer;

  beforeAll(async () => {
    owner = await createUser('OWNER');
    accountant = await createUser('ACCOUNTANT');
    carpenter = await createUser('WORKER', { workerRole: 'CARPENTER' });
    customer = await createUser('CUSTOMER');
    otherCustomer = await createUser('CUSTOMER');
  });

  test('customers cannot reach internal modules', async () => {
    for (const url of ['/api/customers', '/api/expenses', '/api/accounting/transactions', '/api/workers', '/api/materials', '/api/audit-logs', '/api/reports/profit-loss', '/api/production']) {
      const res = await api(customer.token).get(url);
      expect([url, res.status]).toEqual([url, 403]);
      expect(res.body.message).toBe('You do not have permission to perform this action.');
    }
  });

  test('accountants cannot change system settings or manage owner accounts', async () => {
    expect((await api(accountant.token).patch('/api/settings', { currency: 'USD' })).status).toBe(403);
    expect((await api(accountant.token).post('/api/users', { name: 'X', email: 'x@test.com', password: 'Secret123', role: 'OWNER' })).status).toBe(403);
    expect((await api(accountant.token).patch(`/api/users/${owner.user._id}`, { isActive: false })).status).toBe(403);
    expect((await api(accountant.token).get('/api/audit-logs')).status).toBe(403);
  });

  test('accountants can access financial modules', async () => {
    expect((await api(accountant.token).get('/api/payments')).status).toBe(200);
    expect((await api(accountant.token).get('/api/expenses')).status).toBe(200);
    expect((await api(accountant.token).get('/api/reports/profit-loss')).status).toBe(200);
  });

  test('workers cannot see finances', async () => {
    expect((await api(carpenter.token).get('/api/payments')).status).toBe(403);
    expect((await api(carpenter.token).get('/api/dashboard/analytics')).status).toBe(403);
    expect((await api(carpenter.token).get('/api/customers')).status).toBe(403);
  });

  test('owner has full access', async () => {
    expect((await api(owner.token).get('/api/audit-logs')).status).toBe(200);
    expect((await api(owner.token).get('/api/settings')).status).toBe(200);
    expect((await api(owner.token).get('/api/dashboard/analytics')).status).toBe(200);
  });

  test('customers only see their own orders', async () => {
    const { product } = await createCatalog();
    const placed = await api(otherCustomer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    expect(placed.status).toBe(201);
    const orderId = placed.body.data._id;

    expect((await api(customer.token).get(`/api/orders/${orderId}`)).status).toBe(404);
    const mine = await api(customer.token).get('/api/orders');
    expect(mine.body.data).toHaveLength(0);
    const theirs = await api(otherCustomer.token).get(`/api/orders/${orderId}`);
    expect(theirs.status).toBe(200);
    // Internal cost data never reaches customers.
    expect(theirs.body.data.items[0].unitCost).toBeUndefined();
    expect(theirs.body.data.internalNotes).toBeUndefined();
  });

  test('public catalog hides cost price and stock thresholds', async () => {
    const { product } = await createCatalog();
    const res = await api().get(`/api/products/${product._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.costPrice).toBeUndefined();
    expect(res.body.data.minStock).toBeUndefined();
    const staffView = await api(owner.token).get(`/api/products/${product._id}`);
    expect(staffView.body.data.costPrice).toBe(30000);
  });

  test('only the owner can change roles and permissions', async () => {
    const target = await createUser('WORKER', { workerRole: 'PAINTER' });
    const res = await api(owner.token).patch(`/api/users/${target.user._id}`, { workerRole: 'SUPERVISOR' });
    expect(res.status).toBe(200);
    expect(await models.AuditLog.countDocuments({ entityId: target.user._id, action: 'PERMISSION_CHANGE' })).toBe(1);
  });

  test('owners cannot deactivate themselves, and the last active owner is protected', async () => {
    const self = await api(owner.token).patch(`/api/users/${owner.user._id}`, { isActive: false });
    expect(self.status).toBe(400);

    const second = await createUser('OWNER');
    expect((await api(owner.token).delete(`/api/users/${second.user._id}`)).status).toBe(200);

    // Now `owner` is the only active owner; even another privileged actor cannot remove it.
    await models.User.updateMany({ role: 'OWNER', _id: { $ne: owner.user._id } }, { isActive: false });
    const userService = require('../services/user.service');
    const ghostOwner = { user: { _id: '000000000000000000000001', role: 'OWNER', name: 'Ghost' } };
    await expect(userService.updateUser(owner.user._id, { isActive: false }, ghostOwner)).rejects.toThrow(/last active owner/);
  });

  test('NoSQL operator injection is stripped', async () => {
    const res = await api().post('/api/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});
