/* eslint-disable no-console */
// Adds demo payments awaiting verification (with receipts) to an existing database, without erasing anything.
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { Customer } = require('../models');
const { addPendingPayments } = require('./seedData');

(async () => {
  if (env.isProduction) {
    console.error('Refusing to add demo data to a production database.');
    process.exit(1);
  }
  try {
    await connectDB(env.MONGO_URI);
    process.env.MUTE_OUTBOUND = '1';
    const customers = await Customer.find().sort({ createdAt: 1 });
    await addPendingPayments(customers);
    console.log('Demo payments awaiting verification added.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
