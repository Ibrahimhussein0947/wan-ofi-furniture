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

// Older databases have a unique index on product SKU; remove it so duplicates are accepted.
async function dropLegacyUniqueSkuIndex() {
  try {
    const coll = mongoose.connection.db.collection('products');
    const indexes = await coll.indexes();
    for (const idx of indexes) {
      if (idx.unique && idx.key && idx.key.sku === 1 && Object.keys(idx.key).length === 1) await coll.dropIndex(idx.name);
    }
  } catch {
    // collection may not exist yet
  }
}

async function connectDB(uri) {
  await mongoose.connect(uri, { autoIndex: true });
  await dropLegacyUniqueSkuIndex();
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
