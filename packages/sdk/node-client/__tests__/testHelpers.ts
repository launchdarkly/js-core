import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

export function createMockLogger(): jest.Mocked<LDLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
