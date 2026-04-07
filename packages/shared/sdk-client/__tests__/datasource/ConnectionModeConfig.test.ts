import { LDLogger } from '@launchdarkly/js-sdk-common';

import validateOptions from '../../src/configuration/validateOptions';
import {
  BACKGROUND_POLL_INTERVAL_SECONDS,
  connectionModesValidator,
  DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
  MODE_DEFINITION_DEFAULTS,
  MODE_TABLE,
  modeDefinitionValidators,
  ModeTable,
} from '../../src/datasource/ConnectionModeConfig';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

function validateModeDefinition(input: unknown, name: string, testLogger?: LDLogger) {
  return validateOptions(
    input,
    modeDefinitionValidators,
    MODE_DEFINITION_DEFAULTS,
    testLogger,
    name,
  );
}

function validateModeTable(
  input: unknown,
  defaults: ModeTable,
  testLogger?: LDLogger,
): Record<string, unknown> {
  const result = connectionModesValidator.validate(input, 'connectionModes', testLogger, defaults);
  return (result?.value ?? { ...defaults }) as Record<string, unknown>;
}

describe('given a valid mode definition', () => {
  it('passes through a valid streaming-like mode definition unchanged', () => {
    const input = {
      initializers: [{ type: 'cache' }, { type: 'polling' }],
      synchronizers: [{ type: 'streaming' }, { type: 'polling' }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through a valid polling entry with pollInterval', () => {
    const input = {
      initializers: [{ type: 'cache' }],
      synchronizers: [{ type: 'polling', pollInterval: 3600 }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through a valid streaming entry with initialReconnectDelay', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'streaming', initialReconnectDelay: 5 }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through endpoint overrides on polling entries', () => {
    const input = {
      initializers: [],
      synchronizers: [
        { type: 'polling', endpoints: { pollingBaseUri: 'https://relay.example.com' } },
      ],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through endpoint overrides on streaming entries', () => {
    const input = {
      initializers: [],
      synchronizers: [
        { type: 'streaming', endpoints: { streamingBaseUri: 'https://stream.example.com' } },
      ],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('treats empty initializers and synchronizers as valid', () => {
    const input = { initializers: [], synchronizers: [] };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given a non-object mode definition', () => {
  it('returns defaults for null', () => {
    const result = validateModeDefinition(null, 'testMode', logger);

    expect(result).toEqual(MODE_DEFINITION_DEFAULTS);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns defaults and warns for a string', () => {
    const result = validateModeDefinition('streaming', 'testMode', logger);

    expect(result).toEqual(MODE_DEFINITION_DEFAULTS);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got string'));
  });

  it('returns defaults and warns for a number', () => {
    const result = validateModeDefinition(42, 'testMode', logger);

    expect(result).toEqual(MODE_DEFINITION_DEFAULTS);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });

  it('returns defaults for undefined', () => {
    const result = validateModeDefinition(undefined, 'testMode', logger);

    expect(result).toEqual(MODE_DEFINITION_DEFAULTS);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given non-array initializers or synchronizers', () => {
  it('replaces non-array initializers with empty array and warns', () => {
    const result = validateModeDefinition(
      { initializers: 'cache', synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"testMode.initializers" should be of type array'),
    );
  });

  it('replaces non-array synchronizers with empty array and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: { type: 'polling' } },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"testMode.synchronizers" should be of type array'),
    );
  });

  it('defaults missing initializers to empty array', () => {
    const result = validateModeDefinition({ synchronizers: [] }, 'testMode', logger);

    expect(result.initializers).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('defaults missing synchronizers to empty array', () => {
    const result = validateModeDefinition({ initializers: [] }, 'testMode', logger);

    expect(result.synchronizers).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given entries with invalid type field', () => {
  it('discards an entry with a misspelled type and warns', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 'cace' }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got cace'));
  });

  it('discards an entry where type is a number', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 123 }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('type'));
  });

  it('discards an entry where type is missing', () => {
    const result = validateModeDefinition(
      { initializers: [{ pollInterval: 30 }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('type'));
  });

  it('discards null entries', () => {
    const result = validateModeDefinition(
      { initializers: [null], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('discards string entries', () => {
    const result = validateModeDefinition(
      { initializers: ['cache'], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps valid entries and discards invalid ones', () => {
    const result = validateModeDefinition(
      {
        initializers: [{ type: 'cache' }, { type: 'invalid' }, { type: 'polling' }],
        synchronizers: [],
      },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([{ type: 'cache' }, { type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('given cache entries in synchronizers', () => {
  it('discards a cache entry from synchronizers and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'cache' }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got cache'));
  });

  it('keeps valid synchronizer entries and discards cache', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [{ type: 'polling' }, { type: 'cache' }, { type: 'streaming' }],
      },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling' }, { type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('allows cache as an initializer', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 'cache' }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result.initializers).toEqual([{ type: 'cache' }]);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given polling entries with invalid config', () => {
  it('drops pollInterval when it is a string and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: '30' }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });

  it('clamps pollInterval to minimum when it is zero', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: 0 }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling', pollInterval: 30 }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });

  it('clamps pollInterval to minimum when it is negative', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: -10 }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling', pollInterval: 30 }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });
});

describe('given streaming entries with invalid config', () => {
  it('drops initialReconnectDelay when it is a string and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'streaming', initialReconnectDelay: 'fast' }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialReconnectDelay'));
  });

  it('clamps initialReconnectDelay to minimum when it is negative', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'streaming', initialReconnectDelay: -1 }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'streaming', initialReconnectDelay: 1 }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialReconnectDelay'));
  });
});

describe('given entries with invalid endpoint config', () => {
  it('discards endpoints when it is not an object and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', endpoints: 'https://example.com' }] },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('endpoints'));
  });

  it('discards pollingBaseUri when it is not a string', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [{ type: 'polling', endpoints: { pollingBaseUri: 123 } }],
      },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollingBaseUri'));
  });

  it('discards streamingBaseUri when it is not a string', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [{ type: 'streaming', endpoints: { streamingBaseUri: true } }],
      },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([{ type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('streamingBaseUri'));
  });

  it('keeps valid endpoint fields and discards invalid ones', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [
          {
            type: 'polling',
            endpoints: {
              pollingBaseUri: 'https://relay.example.com',
              streamingBaseUri: 42,
            },
          },
        ],
      },
      'testMode',
      logger,
    );

    expect(result.synchronizers).toEqual([
      { type: 'polling', endpoints: { pollingBaseUri: 'https://relay.example.com' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('streamingBaseUri'));
  });
});

describe('given no logger', () => {
  it('validates without throwing when logger is undefined', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 'invalid' }], synchronizers: 'bad' },
      'testMode',
    );

    expect(result.initializers).toEqual([]);
    expect(result.synchronizers).toEqual([]);
  });
});

// ----------------------------- connectionModesValidator --------------------------------

describe('given undefined or null mode table input', () => {
  it('returns the built-in MODE_TABLE for undefined', () => {
    const result = validateModeTable(undefined, MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns the built-in MODE_TABLE for null', () => {
    const result = validateModeTable(null, MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given non-object mode table input', () => {
  it('returns defaults and warns for a string', () => {
    const result = validateModeTable('streaming', MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got string'));
  });

  it('returns defaults and warns for an array', () => {
    const result = validateModeTable([{ type: 'cache' }], MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('connectionModes'));
  });

  it('returns defaults and warns for a number', () => {
    const result = validateModeTable(42, MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });
});

describe('given an empty object', () => {
  it('returns the built-in MODE_TABLE unchanged', () => {
    const result = validateModeTable({}, MODE_TABLE, logger);

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given a partial override', () => {
  it('merges a single mode override with built-in defaults', () => {
    const result = validateModeTable(
      {
        streaming: {
          initializers: [{ type: 'polling' }],
          synchronizers: [{ type: 'streaming' }],
        },
      },
      MODE_TABLE,
      logger,
    );

    expect(result.streaming).toEqual({
      initializers: [{ type: 'polling' }],
      synchronizers: [{ type: 'streaming' }],
      fdv1Fallback: { pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS },
    });
    // Other modes retain their defaults.
    expect(result.polling).toEqual(MODE_TABLE.polling);
    expect(result.offline).toEqual(MODE_TABLE.offline);
    expect(result['one-shot']).toEqual(MODE_TABLE['one-shot']);
    expect(result.background).toEqual(MODE_TABLE.background);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('merges multiple mode overrides with built-in defaults', () => {
    const result = validateModeTable(
      {
        offline: { initializers: [], synchronizers: [] },
        background: {
          initializers: [{ type: 'cache' }],
          synchronizers: [{ type: 'polling', pollInterval: 7200 }],
        },
      },
      MODE_TABLE,
      logger,
    );

    expect(result.offline).toEqual({ initializers: [], synchronizers: [] });
    expect((result.background as any).synchronizers).toEqual([
      { type: 'polling', pollInterval: 7200 },
    ]);
    expect(result.streaming).toEqual(MODE_TABLE.streaming);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given unknown mode names', () => {
  it('discards unknown modes and warns', () => {
    const result = validateModeTable(
      {
        turbo: { initializers: [{ type: 'cache' }], synchronizers: [] },
      },
      MODE_TABLE,
      logger,
    );

    expect(result).toEqual(MODE_TABLE);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got turbo'));
  });

  it('keeps valid overrides and discards unknown modes', () => {
    const result = validateModeTable(
      {
        polling: { initializers: [], synchronizers: [{ type: 'polling', pollInterval: 60 }] },
        invalid: { initializers: [], synchronizers: [] },
      },
      MODE_TABLE,
      logger,
    );

    expect(result.polling).toEqual({
      initializers: [],
      synchronizers: [{ type: 'polling', pollInterval: 60 }],
      fdv1Fallback: { pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS },
    });
    expect(result.streaming).toEqual(MODE_TABLE.streaming);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got invalid'));
  });
});

describe('given an invalid mode definition within a known mode', () => {
  it('keeps the built-in default for that mode and warns', () => {
    const result = validateModeTable(
      {
        streaming: 'not-an-object',
      },
      MODE_TABLE,
      logger,
    );

    expect(result.streaming).toEqual(MODE_TABLE.streaming);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps the built-in default when mode value is null', () => {
    const result = validateModeTable(
      {
        polling: null,
      },
      MODE_TABLE,
      logger,
    );

    expect(result.polling).toEqual(MODE_TABLE.polling);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given a custom defaults table', () => {
  it('merges user overrides into the custom defaults instead of MODE_TABLE', () => {
    const customDefaults = {
      ...MODE_TABLE,
      streaming: {
        initializers: [{ type: 'cache' as const }],
        synchronizers: [{ type: 'streaming' as const, initialReconnectDelay: 10 }],
      },
    };

    const result = validateModeTable(
      { polling: { initializers: [], synchronizers: [{ type: 'polling', pollInterval: 120 }] } },
      customDefaults,
      logger,
    );

    // User override applied.
    expect(result.polling).toEqual({
      initializers: [],
      synchronizers: [{ type: 'polling', pollInterval: 120 }],
      fdv1Fallback: { pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS },
    });
    // Custom default retained for streaming (not the built-in MODE_TABLE default).
    expect(result.streaming).toEqual(customDefaults.streaming);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns custom defaults when input is undefined', () => {
    const customDefaults = {
      ...MODE_TABLE,
      background: {
        initializers: [{ type: 'cache' as const }],
        synchronizers: [{ type: 'polling' as const, pollInterval: 1800 }],
      },
    };

    const result = validateModeTable(undefined, customDefaults, logger);

    expect(result.background).toEqual(customDefaults.background);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given no logger for validateModeTable', () => {
  it('validates without throwing when logger is undefined', () => {
    const result = validateModeTable({ streaming: 'bad', unknown: {} }, MODE_TABLE);

    expect(result.streaming).toEqual(MODE_TABLE.streaming);
    expect(result.polling).toEqual(MODE_TABLE.polling);
  });
});

// ----------------------------- fdv1Fallback validation --------------------------------

describe('given MODE_TABLE fdv1Fallback defaults', () => {
  it('has the default poll interval for streaming mode', () => {
    expect(MODE_TABLE.streaming.fdv1Fallback).toEqual({
      pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
    });
  });

  it('has the default poll interval for polling mode', () => {
    expect(MODE_TABLE.polling.fdv1Fallback).toEqual({
      pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
    });
  });

  it('has the background poll interval for background mode', () => {
    expect(MODE_TABLE.background.fdv1Fallback).toEqual({
      pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS,
    });
  });

  it('does not have fdv1Fallback for offline mode', () => {
    expect(MODE_TABLE.offline.fdv1Fallback).toBeUndefined();
  });

  it('does not have fdv1Fallback for one-shot mode', () => {
    expect(MODE_TABLE['one-shot'].fdv1Fallback).toBeUndefined();
  });
});

describe('given a valid fdv1Fallback in a mode definition', () => {
  it('passes through a valid fdv1Fallback with pollInterval', () => {
    const input = {
      initializers: [{ type: 'cache' }],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: { pollInterval: 600 },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toEqual({ pollInterval: 600 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through fdv1Fallback with endpoint overrides', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: {
        pollInterval: 120,
        endpoints: { pollingBaseUri: 'https://relay.example.com' },
      },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toEqual({
      pollInterval: 120,
      endpoints: { pollingBaseUri: 'https://relay.example.com' },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through fdv1Fallback with only endpoints', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: {
        endpoints: { pollingBaseUri: 'https://relay.example.com' },
      },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toEqual({
      endpoints: { pollingBaseUri: 'https://relay.example.com' },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given invalid fdv1Fallback in a mode definition', () => {
  it('clamps pollInterval to minimum when below 30', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: { pollInterval: 5 },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toEqual({ pollInterval: 30 });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });

  it('drops pollInterval when it is a string and warns', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: { pollInterval: 'fast' },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    // validatorOf returns undefined when all nested fields are invalid/dropped.
    expect(result.fdv1Fallback).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });

  it('drops fdv1Fallback when it is not an object and warns', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: 'invalid',
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fdv1Fallback'));
  });

  it('drops invalid endpoint fields within fdv1Fallback', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'polling' }],
      fdv1Fallback: {
        pollInterval: 60,
        endpoints: { pollingBaseUri: 123 },
      },
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result.fdv1Fallback).toEqual({ pollInterval: 60 });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollingBaseUri'));
  });
});

describe('given mode table overrides with fdv1Fallback', () => {
  it('preserves default fdv1Fallback when user override does not specify it', () => {
    const result = validateModeTable(
      {
        streaming: {
          initializers: [{ type: 'polling' }],
          synchronizers: [{ type: 'streaming' }],
        },
      },
      MODE_TABLE,
      logger,
    );

    // The validatorOf merges defaults from MODE_TABLE, so fdv1Fallback
    // is carried through even when the user doesn't specify it.
    expect((result.streaming as any).fdv1Fallback).toEqual({
      pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
    });
    expect((result.streaming as any).initializers).toEqual([{ type: 'polling' }]);
    expect((result.streaming as any).synchronizers).toEqual([{ type: 'streaming' }]);
    // Non-overridden modes retain their defaults including fdv1Fallback.
    expect((result.background as any).fdv1Fallback).toEqual({
      pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS,
    });
  });

  it('uses user-specified fdv1Fallback when provided', () => {
    const result = validateModeTable(
      {
        background: {
          initializers: [{ type: 'cache' }],
          synchronizers: [{ type: 'polling', pollInterval: 7200 }],
          fdv1Fallback: { pollInterval: 7200 },
        },
      },
      MODE_TABLE,
      logger,
    );

    expect((result.background as any).fdv1Fallback).toEqual({ pollInterval: 7200 });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
