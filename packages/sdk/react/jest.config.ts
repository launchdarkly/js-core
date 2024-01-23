import type { JestConfigWithTsJest } from 'ts-jest';
import { defaults as tsjPreset } from 'ts-jest/presets';

const jestConfig: JestConfigWithTsJest = {
  ...tsjPreset,
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['node_modules', 'example', 'dist'],
  // setupFiles: ['./jestSetupFile.ts'],
};

export default jestConfig;
