module.exports = {
  transform: { '^.+\\.ts?$': ['ts-jest', { diagnostics: { ignoreCodes: ['TS151002'] } }] },
  testMatch: ['**/*.test.ts?(x)'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts'],
};
