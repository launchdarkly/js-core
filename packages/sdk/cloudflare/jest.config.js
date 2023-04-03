module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  testMatch: ['**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['node_modules', 'example'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts'],
};
