module.exports = {
  transform: {'^.+\\.ts?$': 'ts-jest'},
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    "platform-node/src/**/*.ts",
    "sdk-common/src/**/*.ts",
    "server-sdk-common/src/**/*.ts"
  ]
};
