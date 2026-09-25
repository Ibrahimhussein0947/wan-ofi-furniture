const mongoose = require('mongoose');
const { detectTransactionSupport } = require('../config/db');
const { clearSettingsCache } = require('../services/settings.service');

// Each test file gets its own database on the shared in-memory replica set.
beforeAll(async () => {
  const dbName = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const uri = process.env.MONGO_URI.replace(/\/(\?|$)/, `/${dbName}$1`);
  await mongoose.connect(uri);
  await detectTransactionSupport();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

afterEach(() => clearSettingsCache());

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
