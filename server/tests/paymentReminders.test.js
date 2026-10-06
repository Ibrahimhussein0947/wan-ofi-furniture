const { api, createUser, createCatalog, models } = require('./helpers');
const { sendPaymentReminders } = require('../jobs/alerts');

const DAY = 24 * 3600 * 1000;

describe('remaining balance and payment reminders', () => {
  let accountant;
  let customer;

  beforeAll(async () => {
    accountant = await createUser('ACCOUNTANT');
    customer = await createUser('CUSTOMER');
    await models.Setting.create({ key: 'global', depositPercent: 40, defaultDeliveryFee: 0, currency: 'ETB' });
  });

  const remindersFor = (orderNumber) =>
    models.Notification.find({ recipient: customer.user._id, type: 'PAYMENT_REMINDER', title: new RegExp(orderNumber) }).lean();

  test('a part payment leaves the rest as balance and the customer is reminded of it', async () => {
    const { product } = await createCatalog({ sellingPrice: 100000 });
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    expect(placed.status).toBe(201);
    const { _id: orderId, orderNumber } = placed.body.data;

    const paid = await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 25000, method: 'CASH' });
    expect(paid.status).toBe(201);
    expect(paid.body.data.order).toMatchObject({ total: 100000, amountPaid: 25000, balance: 75000, paymentStatus: 'PARTIAL' });

    // The payment notice tells the customer what is left, and counts as this week's reminder.
    const received = await models.Notification.findOne({ recipient: customer.user._id, type: 'PAYMENT_RECEIVED', title: new RegExp(orderNumber) }).lean();
    expect(received.message).toMatch(/Remaining balance: 75,000 ETB/);
    await sendPaymentReminders();
    expect(await remindersFor(orderNumber)).toHaveLength(0);

    // Staff can remind the customer at any time.
    const reminded = await api(accountant.token).post(`/api/orders/${orderId}/remind`, {});
    expect(reminded.status).toBe(200);
    const [reminder] = await remindersFor(orderNumber);
    expect(reminder.message).toBe('You have paid 25,000 ETB of 100,000 ETB. Remaining balance: 75,000 ETB.');

    // A week later the daily job reminds them again.
    await models.Order.updateOne({ _id: orderId }, { lastPaymentReminderAt: new Date(Date.now() - 8 * DAY) });
    await sendPaymentReminders();
    expect(await remindersFor(orderNumber)).toHaveLength(2);
    expect((await models.Order.findById(orderId)).lastPaymentReminderAt.getTime()).toBeGreaterThan(Date.now() - DAY);
  });

  test('fully paid orders cannot be reminded, and customers cannot send reminders', async () => {
    const { product } = await createCatalog({ sellingPrice: 10000 });
    const placed = await api(customer.token).post('/api/orders', { items: [{ product: String(product._id), quantity: 1 }], deliveryMethod: 'PICKUP' });
    const orderId = placed.body.data._id;
    expect((await api(customer.token).post(`/api/orders/${orderId}/remind`, {})).status).toBe(403);

    await api(accountant.token).post('/api/payments/customer', { order: orderId, amount: 10000, method: 'CASH' });
    const res = await api(accountant.token).post(`/api/orders/${orderId}/remind`, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fully paid/);
  });
});
