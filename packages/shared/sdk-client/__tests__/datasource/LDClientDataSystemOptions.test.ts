import { LDLogger } from '@launchdarkly/js-sdk-common';

import {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  validateDataSystemOptions,
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

describe('given valid options', () => {
  it('passes through valid connection modes unchanged', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: 'polling', backgroundConnectionMode: 'offline' },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.initialConnectionMode).toBe('polling');
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

  it('passes through automaticModeSwitching granular config', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { lifecycle: true, network: false } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({ lifecycle: true, network: false });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through partial granular config', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { network: true } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({ network: true });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given undefined or null input', () => {
  it('returns platform defaults for undefined', () => {
    const result = validateDataSystemOptions(undefined, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.initialConnectionMode).toBe('streaming');
    expect(result.backgroundConnectionMode).toBe('background');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns platform defaults for null', () => {
    const result = validateDataSystemOptions(null, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.initialConnectionMode).toBe('streaming');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given non-object input', () => {
  it('returns defaults and warns for a string', () => {
    const result = validateDataSystemOptions('streaming', BROWSER_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.initialConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got string'));
  });

  it('returns defaults and warns for a number', () => {
    const result = validateDataSystemOptions(42, BROWSER_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.initialConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });
});

describe('given invalid initialConnectionMode', () => {
  it('falls back to platform default for an unknown mode string', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: 'turbo' },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.initialConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
  });

  it('falls back to platform default when mode is a number', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: 1 },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.initialConnectionMode).toBe('streaming');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });

  it('falls back to platform default when mode is a boolean', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: true },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.initialConnectionMode).toBe('one-shot');
    expect(logger.warn).toHaveBeenCalled();
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
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('boolean | object'));
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

  it('coerces invalid lifecycle field to boolean in granular config and warns', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { lifecycle: 'yes', network: true } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({ lifecycle: true, network: true });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('lifecycle'));
  });

  it('coerces invalid network field to boolean in granular config and warns', () => {
    const result = validateDataSystemOptions(
      { automaticModeSwitching: { lifecycle: false, network: 0 } },
      BROWSER_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.automaticModeSwitching).toEqual({ lifecycle: false, network: false });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('network'));
  });
});

describe('given omitted fields', () => {
  it('fills in platform defaults for omitted fields', () => {
    const result = validateDataSystemOptions({}, MOBILE_DATA_SYSTEM_DEFAULTS, logger);

    expect(result.initialConnectionMode).toBe('streaming');
    expect(result.backgroundConnectionMode).toBe('background');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('allows overriding only some fields', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: 'polling' },
      MOBILE_DATA_SYSTEM_DEFAULTS,
      logger,
    );

    expect(result.initialConnectionMode).toBe('polling');
    expect(result.backgroundConnectionMode).toBe('background');
    expect(result.automaticModeSwitching).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given no logger', () => {
  it('validates without throwing when logger is undefined', () => {
    const result = validateDataSystemOptions(
      { initialConnectionMode: 999, automaticModeSwitching: 'bad' },
      BROWSER_DATA_SYSTEM_DEFAULTS,
    );

    expect(result.initialConnectionMode).toBe('one-shot');
    expect(result.automaticModeSwitching).toBe(false);
  });
});
