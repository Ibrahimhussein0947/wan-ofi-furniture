/* eslint-disable no-console */
/**
 * Zero-setup development: starts an embedded MongoDB replica set (so transactions work),
 * seeds it on first run, then starts the API. Data persists in server/.devdb between runs.
 * Run `npm run dev:memory -- --reset` to wipe and reseed.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

async function main() {
  const dbPath = path.join(__dirname, '..', '.devdb');
  const reset = process.argv.includes('--reset');
  if (reset) fs.rmSync(dbPath, { recursive: true, force: true });
  fs.mkdirSync(dbPath, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ dbPath, port: 27027 }],
  });
  process.env.MONGO_URI = replSet.getUri('wanofi');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  // Throwaway secrets when no .env exists (sessions reset on restart).
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  process.env.MONGO_URI = replSet.getUri('wanofi');
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');
  // Simulated mobile money so the payment flow can be tried without a provider account.
  process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'sandbox';
  process.env.PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || crypto.randomBytes(16).toString('hex');

  const { connectDB } = require('../config/db');
  const { seed } = require('./seedData');
  const { printCredentials } = require('./credentials');
  const { User } = require('../models');

  await connectDB(process.env.MONGO_URI);
  if (reset || !(await User.estimatedDocumentCount())) {
    console.log('Seeding development data (first run)…');
    const { password } = await seed();
    printCredentials(password);
  } else {
    printCredentials(process.env.SEED_DEFAULT_PASSWORD || 'Password123!');
  }

  const { start } = require('../server');
  await start({ mongoUri: process.env.MONGO_URI });

  const stop = async () => {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
