const { Material, Product, ProductionJob, ProductionTask, Order } = require('../models');
const notify = require('../services/notification.service');
const { sendLowStockAlert } = require('../services/inventory.service');
const { getSettings } = require('../services/settings.service');
const { PRODUCTION_STAGES: S, ORDER_STATUS: O } = require('../config/constants');

const DAY = 24 * 3600 * 1000;

/** Daily digest of everything at or below its minimum stock level. */
async function checkLowStock() {
  const [materials, products] = await Promise.all([
    Material.find({ $expr: { $lte: ['$quantity', '$minStock'] } }).lean(),
    Product.find({ madeToOrder: false, $expr: { $lte: ['$quantity', '$minStock'] } }).lean(),
  ]);
  await Promise.all([...materials.map((m) => sendLowStockAlert('MATERIAL', m)), ...products.map((p) => sendLowStockAlert('PRODUCT', p))]);
  return materials.length + products.length;
}

/** Jobs past their expected completion date (one alert per job per day). */
async function checkProductionDelays() {
  const jobs = await ProductionJob.find({
    stage: { $nin: [S.READY_FOR_DELIVERY, S.DELIVERED, S.CANCELLED] },
    expectedCompletionDate: { $lt: new Date() },
    $or: [{ delayNotifiedAt: null }, { delayNotifiedAt: { $lt: new Date(Date.now() - DAY) } }],
  }).lean();
  for (const job of jobs) {
    const daysLate = Math.ceil((Date.now() - job.expectedCompletionDate) / DAY);
    await notify.notifySupervisors({
      type: 'PRODUCTION_DELAY',
      title: `Production delay: ${job.jobNumber}`,
      message: `${job.title} is ${daysLate} day(s) late (stage: ${job.stage.replace(/_/g, ' ').toLowerCase()}).`,
      link: `/app/production/${job._id}`,
    });
    await notify.notifyUsers(job.assignedWorkers, {
      type: 'TASK_DEADLINE',
      title: `Overdue: ${job.jobNumber}`,
      message: `${job.title} was due ${daysLate} day(s) ago.`,
      link: `/app/production/${job._id}`,
    });
  }
  await ProductionJob.updateMany({ _id: { $in: jobs.map((j) => j._id) } }, { $set: { delayNotifiedAt: new Date() } });
  return jobs.length;
}

/** Tasks due within the next 24 hours. */
async function checkTaskDeadlines() {
  const tasks = await ProductionTask.find({
    status: { $ne: 'DONE' },
    assignedTo: { $ne: null },
    dueDate: { $lte: new Date(Date.now() + DAY), $gte: new Date() },
    deadlineNotifiedAt: null,
  })
    .populate('job', 'jobNumber')
    .lean();
  for (const task of tasks) {
    await notify.notifyUsers([task.assignedTo], {
      type: 'TASK_DEADLINE',
      title: `Task due soon: ${task.title}`,
      message: `${task.job?.jobNumber || ''} — due ${new Date(task.dueDate).toLocaleString()}`,
      link: `/app/production/${task.job?._id}`,
    });
  }
  await ProductionTask.updateMany({ _id: { $in: tasks.map((t) => t._id) } }, { $set: { deadlineNotifiedAt: new Date() } });
  return tasks.length;
}

/** Weekly reminder to customers whose furniture is ready or delivered but not fully paid. */
async function sendPaymentReminders() {
  const { currency } = await getSettings();
  const orders = await Order.find({ balance: { $gt: 0 }, status: { $in: [O.READY, O.DELIVERED] } }).lean();
  for (const order of orders) {
    await notify.notifyCustomer(order.customer, {
      type: 'PAYMENT_REMINDER',
      title: `Payment reminder — ${order.orderNumber}`,
      message: `A balance of ${order.balance.toLocaleString()} ${currency} is outstanding on your order.`,
      link: `/account/orders/${order._id}`,
    });
  }
  return orders.length;
}

/** Weekly summary of debts older than 30 days, for the accounts team. */
async function notifyOverdueDebts() {
  const { currency } = await getSettings();
  const [row] = await Order.aggregate([
    { $match: { balance: { $gt: 0 }, status: { $ne: O.CANCELLED }, orderDate: { $lt: new Date(Date.now() - 30 * DAY) } } },
    { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } },
  ]);
  if (!row) return 0;
  await notify.notifyFinance({
    type: 'CUSTOMER_DEBT',
    title: 'Customer debts older than 30 days',
    message: `${row.count} order(s) with ${row.total.toLocaleString()} ${currency} outstanding.`,
    link: '/app/reports?report=customer-debts',
  });
  return 1;
}

module.exports = { checkLowStock, checkProductionDelays, checkTaskDeadlines, sendPaymentReminders, notifyOverdueDebts };
