const { api, createUser, createCatalog, models, PASSWORD, request, app } = require('./helpers');
const emailChannel = require('../services/channels/email');
const smsChannel = require('../services/channels/sms');
const events = require('../services/events.service');
const { clearSettingsCache } = require('../services/settings.service');

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenFromEmail = (mail) => mail.text.match(/token=([a-f\d]{64})/)[1];

beforeEach(() => {
  emailChannel.outbox.length = 0;
  smsChannel.outbox.length = 0;
});

describe('tax', () => {
  let owner;
  let customer;
  beforeAll(async () => {
    owner = await createUser('OWNER');
    customer = await createUser('CUSTOMER');
    await models.Setting.deleteMany({});
    await models.Setting.create({ key: 'global', taxRate: 18, depositPercent: 40 });
    clearSettingsCache();
  });

  test('VAT is added to the discounted goods value and kept on the order', async () => {
    const { product } = await createCatalog({ sellingPrice: 100000 });
    const res = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 2 }], deliveryMethod: 'PICKUP' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ subtotal: 200000, taxRate: 18, tax: 36000, total: 236000, balance: 236000, depositRequired: 94400 });

    const discounted = await api(owner.token).post(`/api/orders/${res.body.data._id}/discount`, { discount: 50000, reason: 'Launch offer' });
    expect(discounted.body.data).toMatchObject({ tax: 27000, total: 177000 });

    // Changing the rate later does not alter existing orders.
    await models.Setting.updateOne({ key: 'global' }, { taxRate: 0 });
    clearSettingsCache();
    const again = await api(owner.token).post(`/api/orders/${res.body.data._id}/discount`, { discount: 0, reason: 'Offer withdrawn' });
    expect(again.body.data).toMatchObject({ tax: 36000, total: 236000 });
  });
});

describe('editing order items', () => {
  test('pending orders can change items; confirmed orders cannot', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog({ sellingPrice: 50000 });
    const { product: other } = await createCatalog({ sellingPrice: 80000 });
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    const id = placed.body.data._id;

    const edited = await api(owner.token).put(`/api/orders/${id}/items`, { items: [{ product: String(other._id), quantity: 2 }], reason: 'Customer upgraded' });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ subtotal: 160000, total: 160000, balance: 160000 });
    expect(edited.body.data.items[0].name).toBe(other.name);
    expect((await api(customer.token).put(`/api/orders/${id}/items`, { items: [{ product: String(product._id), quantity: 1 }], reason: 'x' })).status).toBe(403);

    await api(owner.token).post(`/api/orders/${id}/confirm`, {});
    const blocked = await api(owner.token).put(`/api/orders/${id}/items`, { items: [{ product: String(product._id), quantity: 1 }], reason: 'Too late' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/only be changed while the order is pending/);
  });
});

describe('password reset', () => {
  test('full flow: request, email link, reset, single use', async () => {
    const { user } = await createUser('CUSTOMER');
    const res = await api().post('/api/auth/forgot-password', { email: user.email });
    expect(res.status).toBe(200);
    expect(emailChannel.outbox).toHaveLength(1);
    expect(emailChannel.outbox[0].to).toBe(user.email);
    const token = tokenFromEmail(emailChannel.outbox[0]);

    const reset = await api().post('/api/auth/reset-password', { token, password: 'BrandNew99' });
    expect(reset.status).toBe(200);
    expect((await api().post('/api/auth/login', { email: user.email, password: 'BrandNew99' })).status).toBe(200);
    expect((await api().post('/api/auth/login', { email: user.email, password: PASSWORD })).status).toBe(401);

    const reuse = await api().post('/api/auth/reset-password', { token, password: 'Another99x' });
    expect(reuse.status).toBe(400);
  });

  test('unknown emails get the same answer and no email is sent', async () => {
    const res = await api().post('/api/auth/forgot-password', { email: 'nobody-here@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(emailChannel.outbox).toHaveLength(0);
  });
});

describe('email verification', () => {
  test('new customers must confirm their email before ordering', async () => {
    const reg = await api().post('/api/auth/register', { name: 'New Buyer', email: 'newbuyer@test.com', password: 'Secret123' });
    expect(reg.body.data.user.emailVerified).toBe(false);
    const mail = emailChannel.outbox.find((m) => m.to === 'newbuyer@test.com');
    expect(mail.subject).toMatch(/Confirm your email/);

    const token = reg.body.data.accessToken;
    const { product } = await createCatalog();
    const blocked = await api(token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/confirm your email/i);

    expect((await api().post('/api/auth/verify-email', { token: tokenFromEmail(mail) })).status).toBe(200);
    const ok = await api(token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    expect(ok.status).toBe(201);
  });
});

describe('email and SMS notifications', () => {
  test('confirming an order emails and texts the customer', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER', { phone: '0712345678' });
    const { product } = await createCatalog();
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    await api(owner.token).post(`/api/orders/${placed.body.data._id}/confirm`, {});
    await wait(100); // external delivery runs in the background
    expect(emailChannel.outbox.some((m) => m.to === customer.user.email && /confirmed/.test(m.subject))).toBe(true);
    expect(smsChannel.outbox.some((m) => m.to === '+255712345678' && /confirmed/.test(m.message))).toBe(true);
  });

  test('customers can opt out of SMS', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER', { phone: '0712999888' });
    await api(customer.token).patch('/api/auth/profile', { notificationPrefs: { sms: false } });
    const { product } = await createCatalog();
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    await api(owner.token).post(`/api/orders/${placed.body.data._id}/confirm`, {});
    await wait(100);
    expect(smsChannel.outbox.some((m) => m.to === '+255712999888')).toBe(false);
    expect(emailChannel.outbox.some((m) => m.to === customer.user.email)).toBe(true);
  });
});

describe('mobile money payments (sandbox gateway)', () => {
  let customer;
  let orderId;
  beforeAll(async () => {
    customer = await createUser('CUSTOMER');
    const { product } = await createCatalog({ sellingPrice: 100000, quantity: 0 });
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    orderId = placed.body.data._id;
  });

  const pollIntent = async (reference) => {
    for (let i = 0; i < 40; i += 1) {
      const res = await api(customer.token).get(`/api/payments/mobile/${reference}`);
      if (['SUCCEEDED', 'FAILED'].includes(res.body.data.status)) return res.body.data;
      await wait(50);
    }
    throw new Error('intent never completed');
  };

  test('an approved prompt applies the payment and confirms the order', async () => {
    const res = await api(customer.token).post('/api/payments/mobile', { order: orderId, amount: 50000, network: 'MPESA', phone: '0754123456' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '+255754123456', network: 'MPESA', gateway: 'sandbox' });
    const intent = await pollIntent(res.body.data.reference);
    expect(intent.status).toBe('SUCCEEDED');
    const order = await models.Order.findById(orderId);
    expect(order).toMatchObject({ amountPaid: 50000, status: 'CONFIRMED' });
    expect(await models.Payment.countDocuments({ order: orderId, method: 'MOBILE_PAYMENT' })).toBe(1);
  });

  test('a declined prompt changes nothing', async () => {
    const res = await api(customer.token).post('/api/payments/mobile', { order: orderId, amount: 10000, network: 'TIGO', phone: '0654120000' });
    const intent = await pollIntent(res.body.data.reference);
    expect(intent.status).toBe('FAILED');
    expect((await models.Order.findById(orderId)).amountPaid).toBe(50000);
  });

  test('overpayment and bad numbers are rejected up front', async () => {
    expect((await api(customer.token).post('/api/payments/mobile', { order: orderId, amount: 999999, network: 'MPESA', phone: '0754123456' })).status).toBe(400);
    expect((await api(customer.token).post('/api/payments/mobile', { order: orderId, amount: 1000, network: 'MPESA', phone: '12345' })).status).toBe(400);
  });

  test('webhooks need the secret and are idempotent', async () => {
    const res = await api(customer.token).post('/api/payments/mobile', { order: orderId, amount: 20000, network: 'AIRTEL', phone: '0784111222' });
    expect([res.status, res.body.message]).toEqual([201, expect.any(String)]);
    const { reference } = res.body.data;
    await pollIntent(reference);
    const body = { reference, transactionstatus: 'success', amount: '20000', reference_id: 'DUP' };
    expect((await request(app).post('/api/payments/webhooks/sandbox/wrong-secret').send(body)).status).toBe(404);
    const dup = await request(app).post('/api/payments/webhooks/sandbox/test-webhook-secret').send(body);
    expect(dup.status).toBe(200);
    expect((await models.Order.findById(orderId)).amountPaid).toBe(70000);
  });
});

describe('message attachments and uploads', () => {
  test('photos can be sent; files that are not really images are rejected', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    const ok = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${customer.token}`)
      .field('data', JSON.stringify({ receiver: String(owner.user._id), body: 'Here is my living room' }))
      .attach('attachments', PNG, { filename: 'room.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.attachments[0]).toMatch(/^\/uploads\/messages\/.+\.png$/);

    const fake = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${customer.token}`)
      .field('data', JSON.stringify({ receiver: String(owner.user._id) }))
      .attach('attachments', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.message).toMatch(/does not match its type/);

    const exe = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('images', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(exe.status).toBe(400);
  });
});

describe('branches', () => {
  test('owner manages branches; orders and reports filter by branch', async () => {
    const owner = await createUser('OWNER');
    const accountant = await createUser('ACCOUNTANT');
    expect((await api(accountant.token).post('/api/branches', { name: 'Mwanza', code: 'MWZ' })).status).toBe(403);
    const created = await api(owner.token).post('/api/branches', { name: 'Mwanza Showroom', code: 'mwz' });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('MWZ');

    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog({ sellingPrice: 30000 });
    const staffOrder = await api(owner.token).post('/api/orders', {
      customer: String(customer.customer._id),
      items: [{ product: String(product._id), quantity: 1 }],
      deliveryMethod: 'PICKUP',
      branch: created.body.data._id,
      autoConfirm: true,
    });
    expect(staffOrder.status).toBe(201);
    const list = await api(owner.token).get(`/api/orders?branch=${created.body.data._id}`);
    expect(list.body.data.map((o) => o._id)).toEqual([staffOrder.body.data._id]);
    const sales = await api(owner.token).get(`/api/reports/sales?branch=${created.body.data._id}`);
    expect(sales.body.data.totals.revenue).toBe(30000);
    expect((await api(owner.token).delete(`/api/branches/${created.body.data._id}`)).status).toBe(400);
  });
});

describe('live events', () => {
  test('tickets are single use and events reach subscribers', () => {
    const ticket = events.issueTicket('user-1');
    expect(events.redeemTicket(ticket)).toBe('user-1');
    expect(events.redeemTicket(ticket)).toBeNull();
    const received = [];
    const stop = events.subscribe('user-1', (e) => received.push(e));
    events.publish('user-1', { kind: 'notification' });
    events.publish('user-2', { kind: 'notification' });
    stop();
    events.publish('user-1', { kind: 'late' });
    expect(received).toEqual([{ kind: 'notification' }]);
  });

  test('the stream rejects missing tickets and tickets are issued to logged-in users', async () => {
    expect((await api().get('/api/events/stream?ticket=nope')).status).toBe(401);
    const user = await createUser('CUSTOMER');
    const res = await api(user.token).post('/api/events/ticket');
    expect(res.body.data.ticket).toMatch(/^[a-f\d]{48}$/);
  });
});
