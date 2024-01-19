import type { JestConfigWithTsJest } from 'ts-jest';
import { defaults as tsjPreset } from 'ts-jest/presets';

const jestConfig: JestConfigWithTsJest = {
  ...tsjPreset,
  preset: 'react-native',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.jsx$': 'babel-jest',
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['node_modules/(?!(react-native|@react-native)/)'],
  testPathIgnorePatterns: ['node_modules', 'example', 'dist'],
  setupFiles: ['./jestSetupFile.ts'],
};

export default jestConfig;
