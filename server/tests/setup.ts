import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let replSet: MongoMemoryReplSet | null = null;

beforeAll(async () => {
  // Set test environment secrets if not already populated
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_at_least_32_characters_long';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_at_least_32_characters_long';

  // Spin up an in-memory single-node replica set for ACID transaction support in tests
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
    },
  });

  const uri = replSet.getUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
});

beforeEach(async () => {
  // Clear collections between test runs to ensure complete isolation
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
});
