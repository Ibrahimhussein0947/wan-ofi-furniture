const { MongoMemoryReplSet } = require('mongodb-memory-server');

// A single-node replica set so the transaction code paths are exercised in tests.
module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  global.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_URI = replSet.getUri();
};
