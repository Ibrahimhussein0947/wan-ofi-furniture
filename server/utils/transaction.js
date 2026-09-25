const mongoose = require('mongoose');
const { dbState } = require('../config/db');
const logger = require('./logger');

/**
 * Runs `work(session, afterCommit)` inside a MongoDB transaction when the deployment
 * supports it (replica set / Atlas). On a standalone server `session` is null and each
 * step relies on its own atomic conditional update instead.
 *
 * `work` may be retried on transient errors, so side effects that must happen exactly
 * once (notifications, audit entries) are registered with `afterCommit(fn)` and run
 * only after the transaction has committed.
 */
async function withTransaction(work) {
  let callbacks = [];
  const afterCommit = (fn) => callbacks.push(fn);
  let result;

  if (!dbState.supportsTransactions) {
    result = await work(null, afterCommit);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        callbacks = [];
        result = await work(session, afterCommit);
      });
    } finally {
      await session.endSession();
    }
  }

  for (const fn of callbacks) {
    try {
      await fn(result);
    } catch (err) {
      logger.error('Post-commit side effect failed:', err.message);
    }
  }
  return result;
}

module.exports = { withTransaction };
