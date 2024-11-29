module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testMatch: ['**/__tests__/**/*test.ts?(x)'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'packages/sdk/server-node/src/**/*.ts',
    'packages/shared/common/src/**/*.ts',
    'packages/shared/sdk-server/src/**/*.ts',
  ],
};
