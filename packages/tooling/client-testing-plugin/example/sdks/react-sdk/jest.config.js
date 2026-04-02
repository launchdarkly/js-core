// Jest config for the React SDK + client-testing-plugin example.
//
// `tsconfig.json` is the single source of truth for workspace path aliases.
// `pathsToModuleNameMapper` derives `moduleNameMapper` from those paths so the
// two configs cannot drift. The only entries we add by hand are the `react`
// and `react-dom` overrides, which force resolution to this example's local
// node_modules so React and ReactDOM are not duplicated by the workspace
// hoist (duplicate React copies break hooks).
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
  },
  testMatch: ['**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['node_modules', 'dist'],
  modulePathIgnorePatterns: ['dist'],
  setupFiles: ['./setup-jest.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom(.*)$': '<rootDir>/node_modules/react-dom$1',
  },
};
