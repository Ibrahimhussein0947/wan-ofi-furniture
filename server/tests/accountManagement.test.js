const { api, createUser, createCatalog, models, PASSWORD } = require('./helpers');

describe('admin manages workers', () => {
  test('the owner creates, edits (including email and password) and removes a worker', async () => {
    const owner = await createUser('OWNER');
    const created = await api(owner.token).post('/api/users', {
      name: 'Bekele Tadesse',
      email: `bekele.${Date.now()}@test.com`,
      password: 'Workshop123',
      role: 'WORKER',
      workerRole: 'CARPENTER',
      worker: { wageType: 'DAILY', wageRate: 900 },
    });
    expect(created.status).toBe(201);
    const worker = await models.Worker.findOne({ user: created.body.data._id }).lean();
    expect(worker).toMatchObject({ position: 'CARPENTER', wageType: 'DAILY', wageRate: 900 });

    const newEmail = `bekele.new.${Date.now()}@test.com`;
    const edited = await api(owner.token).patch(`/api/users/${created.body.data._id}`, { name: 'Bekele T.', email: newEmail, password: 'NewPass123' });
    expect(edited.status).toBe(200);
    const login = await api().post('/api/auth/login', { email: newEmail, password: 'NewPass123' });
    expect(login.status).toBe(200);

    const removed = await api(owner.token).delete(`/api/workers/${worker._id}`);
    expect(removed.status).toBe(200);
    expect((await models.User.findById(created.body.data._id).setOptions({ withDeleted: true }).lean()).isActive).toBe(false);
    expect((await api().post('/api/auth/login', { email: newEmail, password: 'NewPass123' })).status).not.toBe(200);
    const list = await api(owner.token).get('/api/workers?limit=100');
    expect(list.body.data.map((w) => w._id)).not.toContain(String(worker._id));
  });

  test('a worker on an unfinished job cannot be removed, and email clashes are refused', async () => {
    const owner = await createUser('OWNER');
    const other = await createUser('ACCOUNTANT');
    const carpenter = await createUser('WORKER', { workerRole: 'CARPENTER' });
    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog();
    const order = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    await models.ProductionJob.create({ jobNumber: `JOB-${Date.now()}`, order: order.body.data._id, customer: customer.customer._id, title: 'Bed', quantity: 1, assignedWorkers: [carpenter.user._id], stage: 'ASSEMBLY' });
    const worker = await models.Worker.findOne({ user: carpenter.user._id }).lean();

    const blocked = await api(owner.token).delete(`/api/workers/${worker._id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/Reassign/);

    const clash = await api(owner.token).patch(`/api/users/${carpenter.user._id}`, { email: other.user.email });
    expect(clash.status).toBe(409);
    expect((await api(carpenter.token).delete(`/api/workers/${worker._id}`)).status).toBe(403);
  });
});

describe('own account', () => {
  test('users change their own sign-in email after confirming their password', async () => {
    const owner = await createUser('OWNER');
    const newEmail = `boss.${Date.now()}@test.com`;
    expect((await api(owner.token).patch('/api/auth/email', { email: newEmail, currentPassword: 'wrong-password' })).status).toBe(400);

    const ok = await api(owner.token).patch('/api/auth/email', { email: newEmail, currentPassword: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user).toMatchObject({ email: newEmail, emailVerified: true });
    expect((await api().post('/api/auth/login', { email: newEmail, password: PASSWORD })).status).toBe(200);
  });

  test('customers must confirm a changed email again', async () => {
    const customer = await createUser('CUSTOMER');
    const newEmail = `shopper.${Date.now()}@test.com`;
    const res = await api(customer.token).patch('/api/auth/email', { email: newEmail, currentPassword: PASSWORD });
    expect(res.body.data.user.emailVerified).toBe(false);
    expect((await models.Customer.findById(customer.customer._id).lean()).email).toBe(newEmail);
  });
});
