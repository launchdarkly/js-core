import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { createLDServerSession, useLDServerSession } from '../../src/server/index';
import type { LDServerSession } from '../../src/server/LDClient';

// The `mock` prefix is required so ts-jest's hoist plugin allows this variable
// to be referenced inside the jest.mock() factory below.
let mockCacheStore: { session: LDServerSession | null } = { session: null };

jest.mock('react', () => ({
  cache: (_fn: unknown) => () => mockCacheStore,
}));

beforeEach(() => {
  mockCacheStore = { session: null };
});

it('useLDServerSession() returns null when no session has been stored', () => {
  const result = useLDServerSession();
  expect(result).toBeNull();
});

it('useLDServerSession() returns the session stored by createLDServerSession()', () => {
  const context: LDContext = { kind: 'user', key: 'test-user' };
  const client = {
    initialized: jest.fn(() => true),
    boolVariation: jest.fn(),
    numberVariation: jest.fn(),
    stringVariation: jest.fn(),
    jsonVariation: jest.fn(),
    boolVariationDetail: jest.fn(),
    numberVariationDetail: jest.fn(),
    stringVariationDetail: jest.fn(),
    jsonVariationDetail: jest.fn(),
    allFlagsState: jest.fn(),
  };
  // @ts-ignore — minimal mock satisfies LDServerBaseClient structurally
  const session = createLDServerSession(client, context);
  const result = useLDServerSession();
  expect(result).toBe(session);
});

describe('given a browser environment (window defined)', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // @ts-ignore
    globalThis.window = {};
  });

  afterEach(() => {
    // @ts-ignore
    globalThis.window = originalWindow;
  });

  it('throws when called in a browser environment', () => {
    expect(() => useLDServerSession()).toThrow(
      'useLDServerSession must only be called on the server',
    );
  });
});
