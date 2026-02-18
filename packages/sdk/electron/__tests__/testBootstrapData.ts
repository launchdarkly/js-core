export const goodBootstrapData = {
  cat: false,
  json: ['a', 'b', 'c', 'd'],
  killswitch: true,
  'my-boolean-flag': false,
  'string-flag': 'is bob',
  $flagsState: {
    cat: {
      variation: 1,
      version: 2,
    },
    json: {
      variation: 1,
      version: 3,
    },
    killswitch: {
      variation: 0,
      version: 5,
    },
    'my-boolean-flag': {
      variation: 1,
      version: 11,
    },
    'string-flag': {
      variation: 1,
      version: 3,
    },
  },
  $valid: true,
};

export const goodBootstrapDataWithReasons = {
  cat: false,
  json: ['a', 'b', 'c', 'd'],
  killswitch: true,
  'my-boolean-flag': false,
  'string-flag': 'is bob',
  $flagsState: {
    cat: { variation: 1, version: 2, reason: { kind: 'OFF' } },
    json: { variation: 1, version: 3, reason: { kind: 'OFF' } },
    killswitch: { variation: 0, version: 5, reason: { kind: 'FALLTHROUGH' } },
    'my-boolean-flag': { variation: 1, version: 11, reason: { kind: 'OFF' } },
    'string-flag': { variation: 1, version: 3, reason: { kind: 'OFF' } },
  },
  $valid: true,
};

/**
 * Mock flag data in the format expected by polling and streaming (put) responses.
 * Used for tests that evaluate flags when connection is not offline.
 */
export const remoteFlagsMockData = {
  'on-off-flag': { version: 1, value: true, variation: 0 },
  'string-flag': { version: 2, value: 'from-remote', variation: 1 },
  'number-flag': { version: 1, value: 100, variation: 0 },
  'json-flag': { version: 1, value: { key: 'value', count: 5 }, variation: 0 },
};
