import { LDLogger, TypeValidators } from '@launchdarkly/js-sdk-common';

import { recordOf, validatorOf } from '../../src/configuration/validateOptions';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

describe('recordOf with built-in defaults', () => {
  const valueValidator = validatorOf({
    name: TypeValidators.String,
    count: TypeValidators.numberWithMin(1),
  });

  const keyValidator = TypeValidators.oneOf('a', 'b', 'c');

  const builtInDefaults = {
    a: { name: 'alpha', count: 10 },
    b: { name: 'beta', count: 20 },
    c: { name: 'gamma', count: 30 },
  };

  const validator = recordOf(keyValidator, valueValidator, { defaults: builtInDefaults });

  it('uses built-in defaults for keys not provided by the caller', () => {
    const result = validator.validate({ a: { name: 'custom' } }, 'test', logger);

    expect(result?.value).toEqual({
      a: { name: 'custom', count: 10 },
      b: { name: 'beta', count: 20 },
      c: { name: 'gamma', count: 30 },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fills in missing fields from the per-key default', () => {
    const result = validator.validate({ b: { count: 99 } }, 'test', logger);

    // name comes from built-in default for key 'b'
    expect((result?.value as any).b).toEqual({ name: 'beta', count: 99 });
  });

  it('returns built-in defaults when input is empty object', () => {
    const result = validator.validate({}, 'test', logger);

    expect(result?.value).toEqual(builtInDefaults);
  });

  it('returns undefined when input is undefined', () => {
    const result = validator.validate(undefined, 'test', logger);

    expect(result).toBeUndefined();
  });

  it('returns undefined when input is null', () => {
    const result = validator.validate(null, 'test', logger);

    expect(result).toBeUndefined();
  });

  it('prefers built-in defaults over caller-provided defaults', () => {
    const callerDefaults = {
      a: { name: 'caller-alpha', count: 1 },
    };

    const result = validator.validate({}, 'test', logger, callerDefaults);

    // Built-in defaults take priority over caller defaults.
    expect(result?.value).toEqual(builtInDefaults);
  });
});

describe('recordOf without built-in defaults', () => {
  const valueValidator = validatorOf({
    name: TypeValidators.String,
    count: TypeValidators.numberWithMin(1),
  });

  const keyValidator = TypeValidators.oneOf('a', 'b');

  const validator = recordOf(keyValidator, valueValidator);

  it('uses caller-provided defaults when no built-in defaults', () => {
    const callerDefaults = {
      a: { name: 'alpha', count: 10 },
      b: { name: 'beta', count: 20 },
    };

    const result = validator.validate({ a: { name: 'custom' } }, 'test', logger, callerDefaults);

    expect((result?.value as any).a).toEqual({ name: 'custom', count: 10 });
    expect((result?.value as any).b).toEqual({ name: 'beta', count: 20 });
  });

  it('uses empty defaults when neither built-in nor caller defaults are provided', () => {
    const result = validator.validate({ a: { name: 'custom' } }, 'test', logger);

    // No defaults to fill in count, so only name is present.
    expect((result?.value as any).a).toEqual({ name: 'custom' });
  });
});
