import { LDLogger } from '@launchdarkly/js-sdk-common';

/**
 * A logger whose four methods are jest mocks, for tests that assert on what was logged.
 */
export type MockLogger = LDLogger & {
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
};

export default function makeMockLogger(): MockLogger {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
}
