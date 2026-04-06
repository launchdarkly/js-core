import { LDLogger } from '@launchdarkly/js-sdk-common';

import validateOptions from '../../src/configuration/validateOptions';
import {
  BACKGROUND_POLL_INTERVAL_SECONDS,
  DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
  MODE_TABLE,
} from '../../src/datasource/ConnectionModeConfig';
import {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  dataSystemValidators,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  type PlatformDataSystemDefaults,
} from '../../src/datasource/LDClientDataSystemOptions';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

function validateDataSystemOptions(
  input: unknown,
  defaults: PlatformDataSystemDefaults,
  testLogger?: LDLogger,
) {
  return validateOptions(
    input,
    dataSystemValidators,
    { ...defaults, connectionModes: MODE_TABLE } as unknown as Record<string, unknown>,
    testLogger,
    'dataSystem',
  );
}

describe('given valid options', () => {
  it('passes through valid backgroundConnectionMode', () => {
    const result = validateDataSystemOptions(
      { backgroundConnectionMode: 'offline' },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.backgroundConnectionMode).toBe('offline');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through automaticModeSwitching boolean', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: true },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through automatic mode config with type discriminant', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { type: 'automatic', lifecycle: true, network: false } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({
      type: 'automatic',
      lifecycle: true,
      network: false,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through partial automatic config', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { type: 'automatic', network: true } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({ type: 'automatic', network: true });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through manual mode config with initialConnectionMode', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({
      type: 'manual',
      initialConnectionMode: 'polling',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given undefined or null input', () => {
  it('returns platform defaults for undefined', () => {
    const result = validateDataSystemOptions(undefined, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.foregroundConnectionMode).toBe('streaming');
    expect(result.backgroundConnectionMode).toBe('background');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns platform defaults for null', () => {
    const result = validateDataSystemOptions(null, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.foregroundConnectionMode).toBe('streaming');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given non-object input', () => {
  it('returns defaults and warns for a string', () => {
    const result = validateDataSystemOptions('streaming', BROWSER_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.foregroundConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got string'));
  });

  it('returns defaults and warns for a number', () => {
    const result = validateDataSystemOptions(42, BROWSER_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.foregroundConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });
});

describe('given invalid backgroundConnectionMode', () => {
  it('falls back to platform default for an unknown mode string', () => {
    const result = validateDataSystemOptions(
      { backgroundConnectionMode: 'sleep' },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.backgroundConnectionMode).toBe('background');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('backgroundConnectionMode'));
  });

  it('falls back to platform default when mode is an object', () => {
    const result = validateDataSystemOptions(
      { backgroundConnectionMode: { type: 'offline' } },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.backgroundConnectionMode).toBe('background');
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('given invalid automaticModeSwitching', () => {
  it('falls back to platform default when value is a string', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: 'yes' },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falls back to platform default when value is a number', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: 1 },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('warns and drops invalid initialConnectionMode in manual mode config', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'turbo' } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    // Invalid initialConnectionMode is dropped, type is preserved
    expect((result.automaticModeSwitching as any).type).toBe('manual');
    expect((result.automaticModeSwitching as any).initialConnectionMode).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
  });
});

describe('given omitted fields', () => {
  it('fills in platform defaults for omitted fields', () => {
    const result = validateDataSystemOptions({}, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.foregroundConnectionMode).toBe('streaming');
    expect(result.backgroundConnectionMode).toBe('background');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('allows overriding only backgroundConnectionMode', () => {
    const result = validateDataSystemOptions(
      { backgroundConnectionMode: 'offline' },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.backgroundConnectionMode).toBe('offline');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given no logger', () => {
  it('validates without throwing when logger is undefined', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: 'bad' },
      BROWSER_DATA_SYSTEM_DEFAULTS,
    );

    expect(result.automaticModeSwitching).toBe(false);
  });
});

describe('given connectionModes with fdv1Fallback', () => {
  it('fills in fdv1Fallback defaults from MODE_TABLE when user omits it', () => {
    const result = validateDataSystemOptions(
      {
        connectionModes: {
          streaming: {
            initializers: [{ type: 'polling' }],
            synchronizers: [{ type: 'streaming' }],
          },
        },
      },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    const modes = result.connectionModes as any;
    expect(modes.streaming.fdv1Fallback).toEqual({
      pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fills in fdv1Fallback.pollInterval when user provides only endpoints', () => {
    const result = validateDataSystemOptions(
      {
        connectionModes: {
          background: {
            initializers: [{ type: 'cache' }],
            synchronizers: [{ type: 'polling', pollInterval: 3600 }],
            fdv1Fallback: {
              endpoints: { pollingBaseUri: 'https://relay.example.com' },
            },
          },
        },
      },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    const modes = result.connectionModes as any;
    expect(modes.background.fdv1Fallback).toEqual({
      pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS,
      endpoints: { pollingBaseUri: 'https://relay.example.com' },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses user-specified fdv1Fallback.pollInterval over the default', () => {
    const result = validateDataSystemOptions(
      {
        connectionModes: {
          streaming: {
            initializers: [{ type: 'cache' }],
            synchronizers: [{ type: 'streaming' }],
            fdv1Fallback: { pollInterval: 120 },
          },
        },
      },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    const modes = result.connectionModes as any;
    expect(modes.streaming.fdv1Fallback).toEqual({ pollInterval: 120 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('preserves MODE_TABLE defaults for modes the user does not override', () => {
    const result = validateDataSystemOptions(
      {
        connectionModes: {
          polling: {
            initializers: [{ type: 'cache' }],
            synchronizers: [{ type: 'polling', pollInterval: 60 }],
          },
        },
      },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    const modes = result.connectionModes as any;
    // User overrode polling; background retains MODE_TABLE default.
    expect(modes.background.fdv1Fallback).toEqual({
      pollInterval: BACKGROUND_POLL_INTERVAL_SECONDS,
    });
    expect(modes.streaming.fdv1Fallback).toEqual({
      pollInterval: DEFAULT_FDV1_FALLBACK_POLL_INTERVAL_SECONDS,
    });
  });

  it('clamps fdv1Fallback.pollInterval to minimum 30', () => {
    const result = validateDataSystemOptions(
      {
        connectionModes: {
          streaming: {
            initializers: [],
            synchronizers: [{ type: 'polling' }],
            fdv1Fallback: { pollInterval: 5 },
          },
        },
      },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    const modes = result.connectionModes as any;
    expect(modes.streaming.fdv1Fallback.pollInterval).toBe(30);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });
});
