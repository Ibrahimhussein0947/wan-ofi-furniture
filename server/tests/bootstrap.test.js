const { models, api, PASSWORD } = require('./helpers');
const { createFirstOwner, ensureOwnerFromEnv } = require('../services/bootstrap.service');

const logger = { info: () => {} };

describe('first owner account', () => {
  beforeEach(() => models.User.deleteMany({ role: 'OWNER' }));

  test('nothing is created without OWNER_EMAIL and OWNER_PASSWORD', async () => {
    expect(await ensureOwnerFromEnv({}, logger)).toBeNull();
    expect(await models.User.countDocuments({ role: 'OWNER' })).toBe(0);
  });

  test('the owner is created from the environment once and can sign in', async () => {
    const env = { OWNER_NAME: 'Wan Ofi Owner', OWNER_EMAIL: 'Boss@Example.com', OWNER_PASSWORD: PASSWORD };
    const owner = await ensureOwnerFromEnv(env, logger);
    expect(owner).toMatchObject({ email: 'boss@example.com', role: 'OWNER', emailVerified: true });
    // A restart with the variables still set changes nothing.
    expect(await ensureOwnerFromEnv(env, logger)).toBeNull();
    expect(await models.User.countDocuments({ role: 'OWNER' })).toBe(1);

    const login = await api().post('/api/auth/login', { email: 'boss@example.com', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('OWNER');
  });

  test('a second owner cannot be created this way, and weak passwords are refused', async () => {
    await expect(createFirstOwner({ name: 'Owner', email: 'a@example.com', password: 'short' })).rejects.toThrow(/password/);
    await createFirstOwner({ name: 'Owner', email: 'a@example.com', password: PASSWORD });
    await expect(createFirstOwner({ name: 'Intruder', email: 'b@example.com', password: PASSWORD })).rejects.toThrow(/already exists/);
  });
});
