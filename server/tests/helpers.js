const jwt = require('jsonwebtoken');
const request = require('supertest');
const env = require('../config/env');
const app = require('../app');
const models = require('../models');
const { nextNumber } = require('../models/Counter');

const PASSWORD = 'Password123!';
let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq += 1)}`;

const tokenFor = (user) => jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: '15m' });

async function createUser(role = 'OWNER', extra = {}) {
  const user = await models.User.create({
    name: `${role} ${uid()}`,
    email: `${role.toLowerCase()}.${uid()}@test.com`,
    password: PASSWORD,
    role,
    emailVerified: true,
    ...extra,
  });
  if (role === 'WORKER') {
    await models.Worker.create({ user: user._id, employeeCode: await nextNumber('EMP', { yearly: false }), position: extra.workerRole });
  }
  let customer;
  if (role === 'CUSTOMER') {
    customer = await models.Customer.create({ user: user._id, customerCode: await nextNumber('CUS', { yearly: false }), name: user.name, email: user.email, phone: '+251900000000', address: { city: 'Addis Ababa' } });
  }
  return { user, customer, token: tokenFor(user) };
}

async function createCatalog({ quantity = 5, madeToOrder = true, sellingPrice = 50000, costPrice = 30000, withBom = true } = {}) {
  const category = await models.Category.create({ name: `Cat ${uid()}`, slug: `cat-${uid()}` });
  const wood = await models.Material.create({ name: 'Wood', code: `W${uid()}`, unit: 'piece', quantity: 100, minStock: 10, unitCost: 1000 });
  const glue = await models.Material.create({ name: 'Glue', code: `G${uid()}`, unit: 'litre', quantity: 10, minStock: 2, unitCost: 500 });
  const product = await models.Product.create({
    name: `Sofa ${uid()}`,
    sku: `SKU-${uid()}`.toUpperCase(),
    category: category._id,
    price: sellingPrice,
    costPrice,
    sellingPrice,
    quantity,
    minStock: 1,
    madeToOrder,
    colors: ['Grey', 'Blue'],
  });
  if (withBom) {
    await models.BillOfMaterials.create({ product: product._id, items: [{ material: wood._id, quantity: 20 }, { material: glue._id, quantity: 2 }] });
  }
  return { category, product, wood, glue };
}

const api = (token) => {
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (url) => withAuth(request(app).get(url)),
    post: (url, body) => withAuth(request(app).post(url)).send(body),
    patch: (url, body) => withAuth(request(app).patch(url)).send(body),
    put: (url, body) => withAuth(request(app).put(url)).send(body),
    delete: (url) => withAuth(request(app).delete(url)),
  };
};

// 1×1 transparent PNG, used as an uploaded image (e.g. a payment receipt).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** Submits a customer bank-transfer payment with a receipt image attached. */
const submitPayment = (token, body) =>
  request(app)
    .post('/api/payments/submit')
    .set('Authorization', `Bearer ${token}`)
    .field('data', JSON.stringify(body))
    .attach('screenshot', PNG, { filename: 'receipt.png', contentType: 'image/png' });

module.exports = { app, models, PASSWORD, uid, tokenFor, createUser, createCatalog, api, request, PNG, submitPayment };
