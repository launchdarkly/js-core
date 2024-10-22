export default {
  extensionsToTreatAsEsm: ['.ts'],
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['./dist', './src'],
  testMatch: ['**.test.ts'],
  setupFiles: ['./setup-jest.js'],
};
