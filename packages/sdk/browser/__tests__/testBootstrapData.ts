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
    cat: {
      variation: 1,
      version: 2,
      reason: {
        kind: 'OFF',
      },
    },
    json: {
      variation: 1,
      version: 3,
      reason: {
        kind: 'OFF',
      },
    },
    killswitch: {
      variation: 0,
      version: 5,
      reason: {
        kind: 'FALLTHROUGH',
      },
    },
    'my-boolean-flag': {
      variation: 1,
      version: 11,
      reason: {
        kind: 'OFF',
      },
    },
    'string-flag': {
      variation: 1,
      version: 3,
      reason: {
        kind: 'OFF',
      },
    },
  },
  $valid: true,
};
