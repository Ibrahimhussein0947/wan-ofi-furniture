const { api, createUser, request, app, models, PASSWORD } = require('./helpers');

const cookieFrom = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('wo_rt='))?.split(';')[0];

describe('authentication', () => {
  test('customer can register and receives a session', async () => {
    const res = await api().post('/api/auth/register', { name: 'Jane Doe', email: 'jane@test.com', password: 'Secret123', phone: '+251911111111' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.password).toBeUndefined();
    expect(cookieFrom(res)).toBeTruthy();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(await models.Customer.countDocuments({ email: 'jane@test.com' })).toBe(1);
  });

  test('registration rejects weak passwords and duplicate emails', async () => {
    const weak = await api().post('/api/auth/register', { name: 'Weak', email: 'weak@test.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.success).toBe(false);

    await api().post('/api/auth/register', { name: 'Dup', email: 'dup@test.com', password: 'Secret123' });
    const dup = await api().post('/api/auth/register', { name: 'Dup', email: 'dup@test.com', password: 'Secret123' });
    expect(dup.status).toBe(409);
  });

  test('registration cannot escalate privileges', async () => {
    const res = await api().post('/api/auth/register', { name: 'Sneaky', email: 'sneaky@test.com', password: 'Secret123', role: 'OWNER' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CUSTOMER');
  });

  test('login succeeds with valid credentials and fails with a generic message', async () => {
    const { user } = await createUser('ACCOUNTANT');
    const ok = await api().post('/api/auth/login', { email: user.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.effectivePermissions).toContain('payments:write');

    const bad = await api().post('/api/auth/login', { email: user.email, password: 'WrongPass1' });
    expect(bad.status).toBe(401);
    expect(bad.body.message).toBe('Invalid login credentials.');

    const unknown = await api().post('/api/auth/login', { email: 'nobody@test.com', password: 'WrongPass1' });
    expect(unknown.body.message).toBe('Invalid login credentials.');
  });

  test('account locks after repeated failed logins', async () => {
    const { user } = await createUser('CUSTOMER');
    for (let i = 0; i < 5; i += 1) {
      await api().post('/api/auth/login', { email: user.email, password: 'WrongPass1' });
    }
    const res = await api().post('/api/auth/login', { email: user.email, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/locked/i);
  });

  test('deactivated users cannot log in or use existing tokens', async () => {
    const { user, token } = await createUser('WORKER', { workerRole: 'CARPENTER' });
    await models.User.updateOne({ _id: user._id }, { isActive: false });
    expect((await api().post('/api/auth/login', { email: user.email, password: PASSWORD })).status).toBe(403);
    expect((await api(token).get('/api/auth/me')).status).toBe(401);
  });

  test('refresh tokens rotate and a reused token revokes the session family', async () => {
    const { user } = await createUser('OWNER');
    const login = await api().post('/api/auth/login', { email: user.email, password: PASSWORD });
    const first = cookieFrom(login);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(refreshed.status).toBe(200);
    const second = cookieFrom(refreshed);
    expect(second).not.toEqual(first);

    // Replaying the old token is treated as theft.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);
    const afterReplay = await request(app).post('/api/auth/refresh').set('Cookie', second);
    expect(afterReplay.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const { user } = await createUser('CUSTOMER');
    const login = await api().post('/api/auth/login', { email: user.email, password: PASSWORD });
    const cookie = cookieFrom(login);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(await models.AuditLog.countDocuments({ user: user._id, action: 'LOGOUT' })).toBe(1);
  });

  test('protected routes require a token', async () => {
    const res = await api().get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Please log in to continue.' });
  });

  test('changing password signs out other sessions', async () => {
    const { user, token } = await createUser('CUSTOMER');
    const login = await api().post('/api/auth/login', { email: user.email, password: PASSWORD });
    const res = await api(token).patch('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'NewSecret99' });
    expect(res.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookieFrom(login))).status).toBe(401);
    expect((await api().post('/api/auth/login', { email: user.email, password: 'NewSecret99' })).status).toBe(200);
  });
});
