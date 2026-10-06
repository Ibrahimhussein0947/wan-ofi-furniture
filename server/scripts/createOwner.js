/* eslint-disable no-console */
/**
 * Creates the first owner account on a new (e.g. production) database.
 *
 *   npm run create-owner -- --name "Full Name" --email owner@example.com --password "Secret123"
 *
 * Values can also come from OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD. Refuses if an owner already exists.
 */
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { createFirstOwner } = require('../services/bootstrap.service');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const input = {
    name: arg('name') || env.OWNER_NAME,
    email: arg('email') || env.OWNER_EMAIL,
    password: arg('password') || env.OWNER_PASSWORD,
  };
  if (!input.email || !input.password) {
    console.error('Usage: npm run create-owner -- --name "Full Name" --email owner@example.com --password "Secret123"');
    process.exit(1);
  }
  try {
    await connectDB(env.MONGO_URI);
    const owner = await createFirstOwner(input);
    console.log(`Owner account created: ${owner.email}. Sign in at ${env.APP_URL}/login`);
  } catch (err) {
    console.error(`Could not create the owner: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
