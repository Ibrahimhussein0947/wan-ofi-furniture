const { models, api, createUser, createCatalog } = require('./helpers');
const settingsService = require('../services/settings.service');

const setSwitches = async (systems) => {
  await models.Setting.findOneAndUpdate({ key: 'global' }, { $set: { systems } }, { upsert: true });
  settingsService.clearSettingsCache();
};

describe('super admin system switches', () => {
  afterEach(() => setSwitches({ master: true, storefront: true, customers: true, staff: true }));

  test('only the super admin can read the overview or flip switches', async () => {
    const owner = await createUser('OWNER');
    const admin = await createUser('SUPER_ADMIN');
    expect((await api(owner.token).get('/api/superadmin/overview')).status).toBe(403);
    expect((await api(owner.token).patch('/api/superadmin/systems', { master: false })).status).toBe(403);
    const res = await api(admin.token).get('/api/superadmin/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.systems.master).toBe(true);
    expect(res.body.data.health.database).toBe('connected');
  });

  test('switching everything off shows other users a vague 503 but not the super admin', async () => {
    const admin = await createUser('SUPER_ADMIN');
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    await createCatalog();

    const off = await api(admin.token).patch('/api/superadmin/systems', { master: false });
    expect(off.status).toBe(200);
    expect(off.body.data.master).toBe(false);

    for (const token of [undefined, owner.token, customer.token]) {
      const res = await api(token).get('/api/products');
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, message: 'Something went wrong', code: 'SYSTEM_OFF' });
    }
    expect((await api(admin.token).get('/api/products')).status).toBe(200);
    expect((await api(admin.token).get('/api/superadmin/overview')).status).toBe(200);
    expect((await api().get('/api/health')).status).toBe(200);

    await api(admin.token).patch('/api/superadmin/systems', { master: true });
    expect((await api(owner.token).get('/api/products')).status).toBe(200);
  });

  test('area switches only block their own users', async () => {
    const admin = await createUser('SUPER_ADMIN');
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    await api(admin.token).patch('/api/superadmin/systems', { staff: false });
    expect((await api(owner.token).get('/api/products')).status).toBe(503);
    expect((await api(customer.token).get('/api/products')).status).toBe(200);
    expect((await api().get('/api/products')).status).toBe(200);
  });

  test('owners cannot see or edit the super admin account', async () => {
    const admin = await createUser('SUPER_ADMIN');
    const owner = await createUser('OWNER');
    const list = await api(owner.token).get('/api/users?limit=100');
    expect(list.body.data.some((u) => String(u._id) === String(admin.user._id))).toBe(false);
    expect((await api(owner.token).patch(`/api/users/${admin.user._id}`, { name: 'Hacked' })).status).toBe(404);
  });
});
