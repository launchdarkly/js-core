module.exports = {
  transform: {'^.+\\.ts?$': 'ts-jest'},
  testMatch: ["**/__tests__/**/*test.ts?(x)"],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    "platform-node/src/**/*.ts",
    "sdk-common/src/**/*.ts",
    "server-sdk-common/src/**/*.ts"
  ]
};
