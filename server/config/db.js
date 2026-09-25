const mongoose = require('mongoose');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

const state = { supportsTransactions: false };

async function detectTransactionSupport() {
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    // Transactions need a replica set or a sharded cluster (Atlas always qualifies).
    state.supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    state.supportsTransactions = false;
  }
  return state.supportsTransactions;
}

async function connectDB(uri) {
  await mongoose.connect(uri, { autoIndex: true });
  await detectTransactionSupport();
  logger.info(
    `MongoDB connected (${mongoose.connection.host}) — transactions ${state.supportsTransactions ? 'enabled' : 'unavailable, using atomic updates only'}`
  );
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, detectTransactionSupport, dbState: state };
