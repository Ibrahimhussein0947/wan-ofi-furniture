const express = require('express');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { publicFormLimiter } = require('../middleware/rateLimit');
const opsV = require('../validators/operations.validator');
const system = require('../controllers/system.controller');
const financeController = require('../controllers/finance.controller');
const events = require('../controllers/events.controller');

const authRoutes = require('./auth.routes');
const catalog = require('./catalog.routes');
const people = require('./people.routes');
const inventory = require('./inventory.routes');
const orders = require('./order.routes');
const production = require('./production.routes');
const finance = require('./finance.routes');
const sys = require('./system.routes');

const router = express.Router();

// ---- Public ----
router.use('/auth', authRoutes);
router.get('/public/settings', system.publicSettings);
router.post('/public/contact', publicFormLimiter, validate({ body: opsV.contact }), system.contact);
router.post('/payments/webhooks/:gateway/:secret', express.json({ limit: '100kb' }), financeController.paymentWebhook);
router.post('/telegram/webhook/:secret', express.json({ limit: '100kb' }), require('../controllers/telegram.controller').webhook);
router.get('/events/stream', events.stream);
router.use('/categories', catalog.categories);
router.use('/products', catalog.products);

// ---- Everything below requires a logged-in user; each route checks its own permission ----
router.use(requireAuth);

router.use('/users', people.users);
router.use('/customers', people.customers);
router.use('/workers', people.workers);

router.use('/materials', inventory.materials);
router.use('/inventory', inventory.inventory);
router.use('/bom', inventory.bom);
router.use('/suppliers', inventory.suppliers);
router.use('/purchases', inventory.purchases);

router.use('/orders', orders.orders);
router.use('/custom-orders', orders.customOrders);

router.use('/production', production.production);
router.use('/tasks', production.tasks);
router.use('/quality', production.quality);
router.use('/deliveries', production.deliveries);

router.use('/payments', finance.payments);
router.use('/invoices', finance.invoices);
router.use('/expenses', finance.expenses);
router.use('/accounting', finance.accounting);
router.use('/reports', finance.reports);
router.use('/dashboard', finance.dashboard);

router.use('/notifications', sys.notifications);
router.use('/messages', sys.messages);
router.use('/audit-logs', sys.auditLogs);
router.use('/settings', sys.settings);
router.use('/search', sys.search);
router.use('/uploads', sys.uploads);
router.use('/branches', sys.branches);
router.use('/reviews', catalog.reviews);
router.use('/wishlist', catalog.wishlist);
router.use('/promotions', require('./promotion.routes'));
router.post('/events/ticket', events.ticket);

module.exports = router;
