/* eslint-disable no-console */
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { seed } = require('./seedData');
const { printCredentials } = require('./credentials');

(async () => {
  if (env.isProduction && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    console.error('Refusing to seed a production database. This script ERASES all data.');
    process.exit(1);
  }
  try {
    await connectDB(env.MONGO_URI);
    const { password } = await seed();
    printCredentials(password);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
