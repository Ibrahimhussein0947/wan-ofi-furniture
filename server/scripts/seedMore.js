/* eslint-disable no-console */
// Adds more demo customers, orders and payments to an existing database. Additive: nothing is erased.
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { Customer, Order, Product, User } = require('../models');
const { nextNumber } = require('../models/Counter');
const orderService = require('../services/order.service');
const paymentService = require('../services/payment.service');
const invoiceService = require('../services/invoice.service');
const { demoReceipt, actorOf } = require('./seedData');

const NEW_CUSTOMERS = [
  ['Selam Tesfaye', 'selam@example.com', '+251 913 100 301', 'Kebele 05', 'Bale Robe'],
  ['Dawit Alemu', 'dawit@example.com', '+251 913 100 302', 'Piazza', 'Bahir Dar'],
  ['Zahra Mohammed', 'zahra@example.com', '+251 913 100 303', 'Kebele 02', 'Bale Robe'],
  ['Bereket Hailu', 'bereket@example.com', '+251 913 100 304', 'Kebele 06', 'Bale Robe'],
];

// [customer index, [[sku, qty, color]], payment plan]
// plan: 'none' | { cash: fraction } already confirmed | { pending: fraction, receipt: bool, method, bank }
const ORDERS = [
  [0, [['BED-LAL-K', 1, 'Walnut']], { cash: 0.5 }],
  [0, [['CHR-MEK', 4, 'Natural']], { pending: 0.25, receipt: true, method: 'MOBILE_PAYMENT', bank: 'Telebirr' }],
  [1, [['SOF-RDS-3', 1, 'Charcoal']], { pending: 0.5, receipt: true, method: 'BANK_TRANSFER', bank: 'Commercial Bank of Ethiopia' }],
  [1, [['TBL-AWA-C', 1, 'Walnut']], 'none'],
  [2, [['WRD-AXU-3', 1, 'White']], { cash: 0.4 }],
  [2, [['DIN-JIM-S', 1, 'Walnut']], { pending: 1, receipt: true, method: 'BANK_TRANSFER', bank: 'Awash Bank' }],
  [3, [['TV-ADA-180', 1, 'Black']], { pending: 0.1, receipt: false, method: 'BANK_TRANSFER', bank: 'Awash Bank' }],
  [3, [['OFF-EXE-D', 1, 'Walnut'], ['OFF-ERG-C', 2, 'Black']], 'none'],
];

(async () => {
  if (env.isProduction) {
    console.error('Refusing to add demo data to a production database.');
    process.exit(1);
  }
  try {
    await connectDB(env.MONGO_URI);
    process.env.MUTE_OUTBOUND = '1';
    const accountant = await User.findOne({ role: 'ACCOUNTANT' });
    const accActor = actorOf(accountant);

    const customers = [];
    for (const [name, email, phone, street, city] of NEW_CUSTOMERS) {
      let c = await Customer.findOne({ email });
      if (!c) {
        const user = await User.create({ name, email, phone, password: process.env.SEED_DEFAULT_PASSWORD || 'Password123!', role: 'CUSTOMER', emailVerified: true });
        c = await Customer.create({ user: user._id, customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }), name, email, phone, address: { street, city, country: 'Ethiopia' }, source: 'ONLINE' });
      }
      customers.push(c);
    }

    let ref = Math.floor(Date.now() / 1000) % 1e7;
    for (const [ci, items, plan] of ORDERS) {
      const customer = customers[ci];
      const user = await User.findById(customer.user);
      const lines = [];
      for (const [sku, quantity, color] of items) {
        const product = await Product.findOne({ sku });
        if (product) lines.push({ product: product._id, quantity, color });
      }
      if (!lines.length) continue;
      const order = await orderService.createOrder({ customer: customer._id, items: lines, deliveryMethod: 'DELIVERY', deliveryAddress: customer.address }, actorOf(user), { isStaff: false });
      await invoiceService.issueInvoice(order._id, {}, accActor);
      const fresh = await Order.findById(order._id);
      if (plan.cash) {
        await paymentService.recordCustomerPayment({ order: order._id, amount: Math.round(fresh.total * plan.cash), method: 'CASH', reference: `CSH${ref++}` }, accActor);
      } else if (plan.pending) {
        ref += 1;
        const amount = Math.round(fresh.total * plan.pending);
        const reference = `FT${ref}`;
        await paymentService.submitCustomerPayment(
          { order: order._id, amount, method: plan.method, reference, percent: Math.round(plan.pending * 100), screenshot: plan.receipt ? await demoReceipt({ bank: plan.bank, amount, reference, payer: customer.name }) : undefined },
          customer._id,
          actorOf(user),
        );
      }
    }
    console.log(`Added ${customers.length} customers and ${ORDERS.length} orders.`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
