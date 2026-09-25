const cron = require('node-cron');
const logger = require('../utils/logger');
const { checkLowStock, checkProductionDelays, checkTaskDeadlines, sendPaymentReminders, notifyOverdueDebts } = require('./alerts');

const tasks = [];

const safe = (name, fn) => async () => {
  try {
    const count = await fn();
    if (count) logger.info(`[job:${name}] sent ${count} notification(s)`);
  } catch (err) {
    logger.error(`[job:${name}] failed:`, err.message);
  }
};

function startJobs() {
  tasks.push(cron.schedule('0 7 * * *', safe('low-stock', checkLowStock)));
  tasks.push(cron.schedule('30 7 * * *', safe('production-delays', checkProductionDelays)));
  tasks.push(cron.schedule('0 */2 * * *', safe('task-deadlines', checkTaskDeadlines)));
  tasks.push(cron.schedule('0 9 * * 1', safe('payment-reminders', sendPaymentReminders)));
  tasks.push(cron.schedule('0 8 * * 1', safe('customer-debts', notifyOverdueDebts)));
  logger.info('Background jobs scheduled');
}

function stopJobs() {
  tasks.forEach((t) => t.stop());
  tasks.length = 0;
}

module.exports = { startJobs, stopJobs };
