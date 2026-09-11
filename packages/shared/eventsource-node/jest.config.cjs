module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testMatch: ['**/__tests__/**/*test.ts?(x)'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts'],
  // launchdarkly-js-test-helpers hands out ports from a per-process static counter, so running
  // this package's test files across multiple jest worker processes lets two files allocate the
  // same port and cross-talk. Run in a single worker so the counter stays globally unique.
  maxWorkers: 1,
};
