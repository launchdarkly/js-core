const base = require('./jest.config');

// Runs the suite against ioredis 5. The default config uses the newest ioredis
// version that the dependency range allows.
module.exports = {
  ...base,
  moduleNameMapper: { '^ioredis$': 'ioredis-v5' },
};
