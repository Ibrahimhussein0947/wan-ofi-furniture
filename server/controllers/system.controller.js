const { Notification, AuditLog, Customer, Order, Product, Worker, Material, Supplier, Invoice, FinancialTransaction, User, Branch, Expense } = require('../models');
const ApiError = require('../utils/ApiError');
const messageService = require('../services/message.service');
const settingsService = require('../services/settings.service');
const { audit, actorFrom } = require('../services/audit.service');
const { notifyOwners } = require('../services/notification.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, pickFilters, dateRangeFilter, escapeRegex } = require('../utils/query');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

// ---------- Notifications ----------
exports.listNotifications = asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  const { items, pagination } = await paginate(Notification, filter, req.query, { sort: { createdAt: -1 } });
  const unread = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  res.json({ success: true, message: 'OK', data: items, pagination, meta: { unread } });
});

exports.unreadCounts = asyncHandler(async (req, res) => {
  const [notifications, messages] = await Promise.all([
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    messageService.unreadCount(req.user._id),
  ]);
  sendSuccess(res, { data: { notifications, messages } });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipient: req.user._id }, { $set: { isRead: true, readAt: new Date() } });
  sendSuccess(res, { message: 'Marked as read' });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  sendSuccess(res, { message: 'All notifications marked as read' });
});

// ---------- Messages ----------
exports.conversations = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await messageService.conversations(req.user) });
});

exports.contacts = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await messageService.contactsFor(req.user) });
});

exports.thread = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await messageService.thread(req.user, req.params.userId, req.query) });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  sendCreated(res, await messageService.sendMessage(req.user, { ...req.body, attachments: req.uploadedFiles || [] }), 'Message sent');
});

// ---------- Audit log ----------
exports.auditLogs = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['action', 'entity', 'user', 'userRole'], ['user']),
    ...dateRangeFilter('createdAt', req.query.from, req.query.to),
  };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ reference: rx }, { description: rx }, { userName: rx }];
  }
  const { items, pagination } = await paginate(AuditLog, filter, req.query, { sort: { createdAt: -1 } });
  sendSuccess(res, { data: items, pagination });
});

// ---------- Settings ----------
exports.getSettings = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settingsService.getSettings({ fresh: true }) });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const before = await settingsService.getSettings({ fresh: true });
  const settings = await settingsService.updateSettings(req.body, req.user._id);
  const changes = Object.fromEntries(Object.keys(req.body).filter((k) => before[k] !== settings[k]).map((k) => [k, { from: before[k], to: settings[k] }]));
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'Setting', description: 'System settings updated', changes });
  sendSuccess(res, { data: settings, message: 'Settings saved' });
});

exports.publicSettings = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settingsService.getPublicSettings() });
});

// ---------- Public contact form ----------
exports.contact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  await notifyOwners({
    type: 'GENERAL',
    title: `Website enquiry: ${subject || 'General'}`,
    message: `${name} (${email}${phone ? `, ${phone}` : ''}): ${message}`.slice(0, 1000),
    data: { name, email, phone, subject },
  });
  sendSuccess(res, { message: 'Thank you! We will get back to you shortly.' });
});

// ---------- Global search ----------
// Each module is searched only if the user may read it.
exports.search = asyncHandler(async (req, res) => {
  const term = String(req.query.q || '').trim();
  if (term.length < 2) return sendSuccess(res, { data: {} });
  const rx = new RegExp(escapeRegex(term.slice(0, 60)), 'i');
  const can = (p) => hasPermission(req.user, p);
  const limit = 5;
  const tasks = {};

  if (can(PERMISSIONS.CUSTOMERS_READ)) tasks.customers = Customer.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }, { customerCode: rx }] }).limit(limit).select('name phone customerCode').lean();
  if (can(PERMISSIONS.ORDERS_READ)) tasks.orders = Order.find({ $or: [{ orderNumber: rx }, { 'items.name': rx }] }).limit(limit).select('orderNumber status total').populate('customer', 'name').lean();
  if (req.user.role !== ROLES.CUSTOMER) tasks.products = Product.find({ $or: [{ name: rx }, { sku: rx }] }).limit(limit).select('name sku sellingPrice').lean();
  if (can(PERMISSIONS.WORKERS_READ)) tasks.workers = User.find({ role: ROLES.WORKER, name: rx }).limit(limit).select('name workerRole').lean().then(async (users) => {
    const workers = await Worker.find({ user: { $in: users.map((u) => u._id) } }).select('user employeeCode').lean();
    return users.map((u) => ({ ...u, workerId: workers.find((w) => String(w.user) === String(u._id))?._id }));
  });
  if (can(PERMISSIONS.MATERIALS_READ)) tasks.materials = Material.find({ $or: [{ name: rx }, { code: rx }] }).limit(limit).select('name quantity unit').lean();
  if (can(PERMISSIONS.SUPPLIERS_READ)) tasks.suppliers = Supplier.find({ $or: [{ name: rx }, { phone: rx }] }).limit(limit).select('name phone balance').lean();
  if (can(PERMISSIONS.INVOICES_READ)) tasks.invoices = Invoice.find({ invoiceNumber: rx }).limit(limit).select('invoiceNumber total status').lean();
  if (can(PERMISSIONS.ACCOUNTING_READ)) tasks.transactions = FinancialTransaction.find({ $or: [{ transactionNumber: rx }, { description: rx }] }).limit(limit).select('transactionNumber type amount date').lean();

  const keys = Object.keys(tasks);
  const results = await Promise.all(keys.map((k) => tasks[k]));
  return sendSuccess(res, { data: Object.fromEntries(keys.map((k, i) => [k, results[i]])) });
});

// ---------- Uploads ----------
exports.upload = asyncHandler(async (req, res) => {
  sendCreated(res, { urls: req.uploadedFiles || [] }, 'Uploaded');
});


// ---------- Branches ----------
exports.listBranches = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  const branches = await Branch.find(filter).sort({ name: 1 }).lean();
  const counts = await Order.aggregate([{ $match: { branch: { $ne: null } } }, { $group: { _id: '$branch', orders: { $sum: 1 }, sales: { $sum: '$total' } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  sendSuccess(res, { data: branches.map((b) => ({ ...b, orders: byId.get(String(b._id))?.orders || 0, sales: byId.get(String(b._id))?.sales || 0 })) });
});

exports.createBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.create(req.body);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Branch', entityId: branch._id, reference: branch.code });
  sendCreated(res, branch, 'Branch created');
});

exports.updateBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw ApiError.notFound('Branch not found.');
  Object.assign(branch, req.body);
  await branch.save();
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'Branch', entityId: branch._id, reference: branch.code });
  sendSuccess(res, { data: branch, message: 'Branch updated' });
});

exports.deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw ApiError.notFound('Branch not found.');
  const inUse = (await Order.exists({ branch: branch._id })) || (await Expense.exists({ branch: branch._id })) || (await User.exists({ branch: branch._id }));
  if (inUse) throw ApiError.badRequest('This branch has orders, expenses or staff. Deactivate it instead.');
  await branch.softDelete(req.user._id);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.DELETE, entity: 'Branch', entityId: branch._id, reference: branch.code });
  sendSuccess(res, { message: 'Branch removed' });
});
