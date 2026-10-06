const { api, createUser, createCatalog, models, request, app } = require('./helpers');
const env = require('../config/env');
const telegram = require('../services/channels/telegram');
const whatsapp = require('../services/channels/whatsapp');
const { clearSettingsCache } = require('../services/settings.service');
const { notifyUsers } = require('../services/notification.service');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Places an order for `product` and marks it delivered (as if fulfilled). */
async function deliveredOrder(customer, product, quantity = 1) {
  const res = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity }], deliveryMethod: 'PICKUP' });
  expect(res.status).toBe(201);
  await models.Order.updateOne({ _id: res.body.data._id }, { $set: { status: 'DELIVERED' } });
  return res.body.data;
}

beforeAll(async () => {
  await models.Setting.deleteMany({});
  await models.Setting.create({ key: 'global', taxRate: 0, depositPercent: 40, customWarrantyMonths: 12 });
  clearSettingsCache();
});

describe('warranty', () => {
  test('the product warranty is copied onto the order and its invoice', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog();
    await models.Product.updateOne({ _id: product._id }, { warrantyMonths: 24, warrantyTerms: 'Frame and joinery' });

    const order = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    expect(order.body.data.items[0]).toMatchObject({ warrantyMonths: 24, warrantyTerms: 'Frame and joinery' });

    // Later edits to the product don't change what was sold.
    await models.Product.updateOne({ _id: product._id }, { warrantyMonths: 6 });
    const invoice = await api(owner.token).post('/api/invoices', { order: order.body.data._id });
    expect(invoice.status).toBe(201);
    expect(invoice.body.data.lines[0]).toMatchObject({ warrantyMonths: 24, warrantyTerms: 'Frame and joinery' });
  });
});

describe('reviews', () => {
  test('only customers who received the product can review it, once, and the rating follows published reviews', async () => {
    const owner = await createUser('OWNER');
    const buyer = await createUser('CUSTOMER');
    const stranger = await createUser('CUSTOMER');
    const { product } = await createCatalog();
    const url = `/api/products/${product._id}/reviews`;

    expect((await api(buyer.token).post(url, { rating: 5 })).status).toBe(403);
    await deliveredOrder(buyer, product);
    expect((await api(buyer.token).get(url)).body.data.canReview).toBe(true);

    const created = await api(buyer.token).post(url, { rating: 4, title: 'Solid', comment: 'Well made' });
    expect(created.status).toBe(201);
    expect((await api(buyer.token).post(url, { rating: 5 })).status).toBe(409);
    expect((await api(stranger.token).post(url, { rating: 1 })).status).toBe(403);
    expect(await models.Product.findById(product._id).lean()).toMatchObject({ rating: 4, reviewCount: 1 });

    const list = await api().get(url);
    expect(list.body.data.items[0]).toMatchObject({ rating: 4, title: 'Solid' });
    expect(list.body.data.items[0].customer).toBeUndefined();

    expect((await api(buyer.token).patch(`/api/reviews/${created.body.data._id}`, { status: 'HIDDEN' })).status).toBe(403);
    await api(owner.token).patch(`/api/reviews/${created.body.data._id}`, { status: 'HIDDEN' });
    expect(await models.Product.findById(product._id).lean()).toMatchObject({ rating: 0, reviewCount: 0 });
    expect((await api().get(url)).body.data.items).toHaveLength(0);
  });
});

describe('wishlist', () => {
  test('customers save, merge and remove favourites; staff have none', async () => {
    const customer = await createUser('CUSTOMER');
    const owner = await createUser('OWNER');
    const { product: a } = await createCatalog();
    const { product: b } = await createCatalog();

    const added = await api(customer.token).put(`/api/wishlist/${a._id}`);
    expect(added.body.data.map((p) => p._id)).toEqual([String(a._id)]);
    expect(added.body.data[0].costPrice).toBeUndefined();

    const merged = await api(customer.token).post('/api/wishlist/merge', { productIds: [String(a._id), String(b._id), 'not-an-id'] });
    expect(merged.body.data.map((p) => p._id).sort()).toEqual([String(a._id), String(b._id)].sort());

    const removed = await api(customer.token).delete(`/api/wishlist/${a._id}`);
    expect(removed.body.data.map((p) => p._id)).toEqual([String(b._id)]);
    expect((await api(owner.token).get('/api/wishlist')).status).toBe(403);
  });
});

describe('promo codes', () => {
  test('a valid code discounts the order once per customer, and cancelling gives the use back', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog({ sellingPrice: 80000 });
    const created = await api(owner.token).post('/api/promotions', { code: 'save10', type: 'PERCENT', value: 10, maxDiscount: 5000, perCustomerLimit: 1 });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('SAVE10');
    expect((await api(customer.token).post('/api/promotions', { code: 'HACK', type: 'FIXED', value: 1 })).status).toBe(403);

    const check = await api(customer.token).post('/api/promotions/check', { code: 'Save10', subtotal: 80000 });
    expect(check.body.data.discount).toBe(5000); // 10% capped at 5,000

    const items = [{ product: String(product._id), quantity: 1 }];
    const order = await api(customer.token).post('/api/orders', { items, deliveryMethod: 'PICKUP', promoCode: 'SAVE10' });
    expect(order.body.data).toMatchObject({ discount: 5000, promoCode: 'SAVE10', promoDiscount: 5000, total: 75000 });

    const again = await api(customer.token).post('/api/orders', { items, deliveryMethod: 'PICKUP', promoCode: 'SAVE10' });
    expect(again.status).toBe(422);

    await api(customer.token).post(`/api/orders/${order.body.data._id}/cancel`, { reason: 'Changed my mind' });
    expect((await api(customer.token).post('/api/promotions/check', { code: 'SAVE10', subtotal: 80000 })).status).toBe(200);
  });

  test('minimum order, expiry and unknown codes are refused', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    await api(owner.token).post('/api/promotions', { code: 'BIG5000', type: 'FIXED', value: 5000, minSubtotal: 60000 });
    await api(owner.token).post('/api/promotions', { code: 'OLD', type: 'PERCENT', value: 5, endsAt: '2020-01-01' });
    const check = (code, subtotal) => api(customer.token).post('/api/promotions/check', { code, subtotal });
    expect((await check('BIG5000', 50000)).status).toBe(422);
    expect((await check('BIG5000', 60000)).body.data.discount).toBe(5000);
    expect((await check('OLD', 90000)).body.message).toMatch(/expired/);
    expect((await check('NOPE', 90000)).status).toBe(422);
  });
});

describe('size search', () => {
  test('products filter by maximum width/depth/height in centimetres, whatever their unit', async () => {
    const { product: small } = await createCatalog();
    const { product: wide } = await createCatalog();
    await models.Product.updateOne({ _id: small._id }, { dimensions: { width: 0.8, depth: 0.5, height: 0.9, unit: 'm' } });
    await models.Product.updateOne({ _id: wide._id }, { dimensions: { width: 250, depth: 90, height: 85, unit: 'cm' } });
    const ids = async (q) => (await api().get(`/api/products?limit=100&${q}`)).body.data.map((p) => p._id);

    const fits = await ids('maxWidth=100');
    expect(fits).toContain(String(small._id));
    expect(fits).not.toContain(String(wide._id));
    expect(await ids('maxWidth=300&maxDepth=60')).not.toContain(String(wide._id));
    expect(await ids('maxHeight=95')).toEqual(expect.arrayContaining([String(small._id), String(wide._id)]));
  });
});

describe('branch stock', () => {
  test('sales come from the order branch, transfers move stock, and a branch cannot go below zero', async () => {
    const owner = await createUser('OWNER');
    const customer = await createUser('CUSTOMER');
    const [hq, north] = await models.Branch.create([
      { name: 'HQ', code: `H${Date.now() % 100000}` },
      { name: 'North', code: `N${Date.now() % 100000}` },
    ]);
    await models.Setting.updateOne({ key: 'global' }, { defaultBranch: hq._id });
    clearSettingsCache();
    try {
      const { product } = await createCatalog({ quantity: 0, madeToOrder: false });
      await api(owner.token).post('/api/inventory/adjust', { itemType: 'PRODUCT', itemId: String(product._id), type: 'STOCK_IN', quantity: 3, note: 'Delivery', branch: String(north._id) });

      // Online orders ship from the default branch (HQ), which has none.
      const online = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
      expect(online.status).toBe(409);

      const moved = await api(owner.token).post('/api/inventory/transfer', { itemType: 'PRODUCT', itemId: String(product._id), from: String(north._id), to: String(hq._id), quantity: 2 });
      expect(moved.status).toBe(200);
      const stock = (await models.Product.findById(product._id).lean()).branchStock;
      expect(stock.find((b) => String(b.branch) === String(hq._id)).quantity).toBe(2);
      expect(stock.find((b) => String(b.branch) === String(north._id)).quantity).toBe(1);
      expect((await models.Product.findById(product._id).lean()).quantity).toBe(3);

      const tooMuch = await api(owner.token).post('/api/inventory/transfer', { itemType: 'PRODUCT', itemId: String(product._id), from: String(north._id), to: String(hq._id), quantity: 5 });
      expect(tooMuch.status).toBe(409);
      expect((await api().get(`/api/products/${product._id}`)).body.data).toMatchObject({ availability: 'IN_STOCK', inStock: 2 });
    } finally {
      await models.Setting.updateOne({ key: 'global' }, { defaultBranch: null });
      clearSettingsCache();
      await models.Branch.deleteMany({ _id: { $in: [hq._id, north._id] } });
    }
  });
});

describe('reorder suggestions', () => {
  test('low materials not already on order are suggested per supplier', async () => {
    const owner = await createUser('OWNER');
    const supplier = await models.Supplier.create({ name: `Timber ${Date.now()}` });
    const low = await models.Material.create({ name: 'Oak board', code: `OAK${Date.now()}`, unit: 'piece', quantity: 2, minStock: 10, unitCost: 100, supplier: supplier._id });
    const find = async () => (await api(owner.token).get('/api/purchases/suggestions')).body.data.flatMap((g) => g.items).find((i) => i.material._id === String(low._id));

    expect(await find()).toMatchObject({ suggestedQuantity: 18 }); // top up to twice the minimum
    await api(owner.token).post('/api/purchases', { supplier: String(supplier._id), status: 'DRAFT', items: [{ material: String(low._id), quantity: 18, unitCost: 100 }] });
    expect(await find()).toBeUndefined();
  });
});

describe('payroll', () => {
  test('hourly and per-job workers are paid from logged hours and finished jobs, less wages already paid', async () => {
    const owner = await createUser('OWNER');
    const hourly = await createUser('WORKER', { workerRole: 'INSTALLER' });
    const perJob = await createUser('WORKER', { workerRole: 'FINISHER' });
    await models.Worker.updateOne({ user: hourly.user._id }, { wageType: 'HOURLY', wageRate: 200 });
    await models.Worker.updateOne({ user: perJob.user._id }, { wageType: 'PER_JOB', wageRate: 5000 });
    const customer = await createUser('CUSTOMER');
    const { product } = await createCatalog();
    const order = await deliveredOrder(customer, product);
    const month = new Date().toISOString().slice(0, 7);
    const job = await models.ProductionJob.create({
      jobNumber: `JOB-${Date.now()}`,
      order: order._id,
      customer: customer.customer._id,
      title: 'Test job',
      quantity: 1,
      assignedWorkers: [hourly.user._id, perJob.user._id],
      stage: 'DELIVERED',
      actualCompletionDate: new Date(),
    });

    expect((await api(hourly.token).post(`/api/production/${job._id}/hours`, { hours: 6 })).status).toBe(200);
    expect((await api(hourly.token).post(`/api/production/${job._id}/hours`, { hours: 2.5 })).status).toBe(200);
    expect((await api(hourly.token).get(`/api/workers/payroll?month=${month}`)).status).toBe(403);

    const worker = await models.Worker.findOne({ user: hourly.user._id });
    await api(owner.token).post('/api/payments/worker', { worker: String(worker._id), amount: 500, method: 'CASH', kind: 'WAGE', payPeriod: month });

    const rows = (await api(owner.token).get(`/api/workers/payroll?month=${month}`)).body.data.rows;
    expect(rows.find((r) => r.worker.name === hourly.user.name)).toMatchObject({ hoursLogged: 8.5, earned: 1700, paid: 500, due: 1200 });
    expect(rows.find((r) => r.worker.name === perJob.user.name)).toMatchObject({ jobsCompleted: 1, earned: 5000, due: 5000 });
  });
});

describe('telegram & whatsapp alerts', () => {
  beforeEach(() => {
    telegram.outbox.length = 0;
    whatsapp.outbox.length = 0;
  });

  test('a user links Telegram through the bot and then receives alerts there; WhatsApp needs an opt-in', async () => {
    env.TELEGRAM_WEBHOOK_SECRET = 'tg-secret';
    const user = await createUser('OWNER', { phone: '0911223344' });
    await api(user.token).post('/api/auth/telegram/link');
    const { telegramLinkCode } = await models.User.findById(user.user._id).select('+telegramLinkCode').lean();

    expect((await request(app).post('/api/telegram/webhook/wrong').send({})).status).toBe(404);
    await request(app).post('/api/telegram/webhook/tg-secret').send({ message: { chat: { id: 777 }, text: `/start ${telegramLinkCode}` } });
    expect((await api(user.token).get('/api/auth/chat-channels')).body.data.telegram.connected).toBe(true);

    await notifyUsers([user.user._id], { type: 'LOW_STOCK', title: 'Low stock: Glue', message: 'Glue is at 1 litre.' });
    await wait(50);
    expect(telegram.outbox.some((m) => m.chatId === '777' && m.title === 'Low stock: Glue')).toBe(true);
    expect(whatsapp.outbox).toHaveLength(0);

    await api(user.token).patch('/api/auth/profile', { notificationPrefs: { whatsapp: true } });
    await notifyUsers([user.user._id], { type: 'LOW_STOCK', title: 'Low stock: Wood' });
    await wait(50);
    expect(whatsapp.outbox[0]).toMatchObject({ to: '+251911223344', title: 'Low stock: Wood' });

    await request(app).post('/api/telegram/webhook/tg-secret').send({ message: { chat: { id: 777 }, text: '/stop' } });
    expect((await api(user.token).get('/api/auth/chat-channels')).body.data.telegram.connected).toBe(false);
  });
});

describe('seo', () => {
  test('robots.txt and the sitemap list the storefront', async () => {
    const { product } = await createCatalog();
    const robots = await request(app).get('/robots.txt');
    expect(robots.text).toMatch(/Disallow: \/app/);
    const sitemap = await request(app).get('/sitemap.xml');
    expect(sitemap.headers['content-type']).toMatch(/xml/);
    expect(sitemap.text).toContain(`/products/${product.slug || ''}`);
  });
});
