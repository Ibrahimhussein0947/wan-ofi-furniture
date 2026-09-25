const env = require('./config/env');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { startJobs, stopJobs } = require('./jobs');
const logger = require('./utils/logger');

async function start({ mongoUri = env.MONGO_URI } = {}) {
  await connectDB(mongoUri);
  const server = app.listen(env.PORT, () => logger.info(`Wan Ofi API listening on http://localhost:${env.PORT}`));
  server.on('error', (err) => {
    logger.error(err.code === 'EADDRINUSE' ? `Port ${env.PORT} is already in use. Set PORT in server/.env to a free port.` : err);
    process.exit(1);
  });
  if (env.ENABLE_CRON) startJobs();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down…`);
    stopJobs();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));

if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { start };
