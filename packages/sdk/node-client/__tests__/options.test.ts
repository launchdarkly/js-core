import type { LDStorage } from '@launchdarkly/js-client-sdk-common';

import validateOptions, { ValidatedOptions } from '../src/options';
import { createMockLogger } from './testHelpers';

// A value no option validator should accept regardless of the field's expected type
const BOGUS_VALUE = Symbol('invalid-option-value');

// Exhaustive over keyof ValidatedOptions: adding a new node-specific option must be added here
// or the file will fail to compile, ensuring every option has type-validation coverage.
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unused-vars
const _wrongTypedOptions: Record<keyof ValidatedOptions, unknown> = {
  tlsParams: BOGUS_VALUE,
  enableEventCompression: BOGUS_VALUE,
  initialConnectionMode: BOGUS_VALUE,
  plugins: BOGUS_VALUE,
  localStoragePath: BOGUS_VALUE,
  storage: BOGUS_VALUE,
  hash: BOGUS_VALUE,
  useMobileKey: BOGUS_VALUE,
  wrapperName: BOGUS_VALUE,
  wrapperVersion: BOGUS_VALUE,
};

let logger: ReturnType<typeof createMockLogger>;

beforeEach(() => {
  logger = createMockLogger();
});

it('applies defaults when no node-specific options are provided', () => {
  const out = validateOptions({}, logger);

  expect(out.initialConnectionMode).toBe('streaming');
  expect(out.plugins).toEqual([]);
  expect(out.tlsParams).toBeUndefined();
  expect(out.enableEventCompression).toBeUndefined();
  expect(out.localStoragePath).toBeUndefined();
  expect(out.storage).toBeUndefined();
  expect(out.useMobileKey).toBe(false);
  expect(out.hash).toBeUndefined();
  expect(out.wrapperName).toBeUndefined();
  expect(out.wrapperVersion).toBeUndefined();
  expect(logger.warn).not.toHaveBeenCalled();
});

it('passes through wrapperName and wrapperVersion', () => {
  const out = validateOptions({ wrapperName: 'my-wrapper', wrapperVersion: '1.0.0' }, logger);
  expect(out.wrapperName).toBe('my-wrapper');
  expect(out.wrapperVersion).toBe('1.0.0');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns and falls back to the default for an invalid initialConnectionMode', () => {
  const out = validateOptions({ initialConnectionMode: 'STREAMING' as any }, logger);

  expect(out.initialConnectionMode).toBe('streaming');
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
});

it('warns when TLS certificate verification is disabled', () => {
  validateOptions({ tlsParams: { rejectUnauthorized: false } }, logger);

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('rejectUnauthorized'));
});

it('accepts a valid Storage implementation', () => {
  const storage: LDStorage = {
    get: async () => null,
    set: async () => {},
    clear: async () => {},
  };
  const validated = validateOptions({ storage }, logger);
  expect(validated.storage).toBe(storage);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('accepts a class-based Storage implementation with prototype methods', () => {
  class MyStorage {
    async get(_key: string): Promise<string | null> { return null; }
    async set(_key: string, _value: string): Promise<void> {}
    async clear(_key: string): Promise<void> {}
  }
  const validated = validateOptions({ storage: new MyStorage() }, logger);
  expect(validated.storage).toBeInstanceOf(MyStorage);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('rejects a non-object storage value and warns', () => {
  const validated = validateOptions({ storage: 'file' as any }, logger);
  expect(validated.storage).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('storage'));
});

it('rejects a storage object missing required methods and warns', () => {
  const validated = validateOptions({ storage: { get: async () => null } as any }, logger);
  expect(validated.storage).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('storage'));
});

it('rejects a storage object with non-function methods and warns', () => {
  const validated = validateOptions(
    { storage: { get: 'not-a-fn', set: async () => {}, clear: async () => {} } as any },
    logger,
  );
  expect(validated.storage).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('storage'));
});

it('passes through localStoragePath as a string', () => {
  const out = validateOptions({ localStoragePath: '/var/cache/myapp' }, logger);
  expect(out.localStoragePath).toBe('/var/cache/myapp');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns and ignores localStoragePath when it is not a string', () => {
  const out = validateOptions({ localStoragePath: 42 as any }, logger);
  expect(out.localStoragePath).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('localStoragePath'));
});

it('warns when both localStoragePath and storage are set', () => {
  const storage: LDStorage = {
    get: async () => null,
    set: async () => {},
    clear: async () => {},
  };
  validateOptions({ localStoragePath: '/var/cache/myapp', storage }, logger);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('localStoragePath'));
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('storage'));
});

it('does not warn when only localStoragePath is set', () => {
  validateOptions({ localStoragePath: '/var/cache/myapp' }, logger);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns when both dataSystem and initialConnectionMode are set', () => {
  const out = validateOptions({ dataSystem: {}, initialConnectionMode: 'offline' }, logger);

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('dataSystem'));
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('dataSystem.automaticModeSwitching.initialConnectionMode'),
  );
  // Warning only: the validated value passes through unchanged. NodeClient ignores it
  // on the FDv2 path.
  expect(out.initialConnectionMode).toBe('offline');
});

it('warns when dataSystem is set alongside an explicit streaming initialConnectionMode', () => {
  validateOptions({ dataSystem: {}, initialConnectionMode: 'streaming' }, logger);

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
});

it('warns when initialConnectionMode is set alongside a manual-mode dataSystem', () => {
  validateOptions(
    {
      dataSystem: { automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' } },
      initialConnectionMode: 'offline',
    },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialConnectionMode'));
});

it('does not warn when dataSystem is set without initialConnectionMode', () => {
  const out = validateOptions({ dataSystem: {} }, logger);

  // The default is applied but the user did not opt in, so no warning is appropriate.
  expect(out.initialConnectionMode).toBe('streaming');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not warn when initialConnectionMode is set without dataSystem', () => {
  const out = validateOptions({ initialConnectionMode: 'offline' }, logger);

  expect(out.initialConnectionMode).toBe('offline');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not warn when dataSystem is null', () => {
  const out = validateOptions({ dataSystem: null as any, initialConnectionMode: 'offline' }, logger);

  // null dataSystem never activates FDv2 (Configuration's validator skips nullish values),
  // so initialConnectionMode is honored and warning here would be wrong.
  expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('dataSystem'));
  expect(out.initialConnectionMode).toBe('offline');
});

it('does not warn when dataSystem is a non-object value', () => {
  validateOptions({ dataSystem: 'streaming' as any, initialConnectionMode: 'offline' }, logger);

  // A non-object dataSystem fails Configuration's own type check and falls back to FDv1
  // there too, so this mirrors the null case above.
  expect(logger.warn).not.toHaveBeenCalledWith(
    expect.stringContaining('Both "dataSystem" and "initialConnectionMode"'),
  );
});

it('does not warn when initialConnectionMode is null', () => {
  validateOptions({ dataSystem: {}, initialConnectionMode: null as any }, logger);

  // The dataSystem/initialConnectionMode conflict check excludes null explicitly, matching
  // how a caller would clear the option to opt back into the FDv2 default.
  expect(logger.warn).not.toHaveBeenCalledWith(
    expect.stringContaining('Both "dataSystem" and "initialConnectionMode"'),
  );
});

it('defaults useMobileKey to false when omitted', () => {
  const validated = validateOptions({}, logger);
  expect(validated.useMobileKey).toBe(false);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('accepts useMobileKey: true', () => {
  const validated = validateOptions({ useMobileKey: true }, logger);
  expect(validated.useMobileKey).toBe(true);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('accepts useMobileKey: false explicitly', () => {
  const validated = validateOptions({ useMobileKey: false }, logger);
  expect(validated.useMobileKey).toBe(false);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('warns and falls back to false when useMobileKey is not a boolean', () => {
  const validated = validateOptions({ useMobileKey: 'yes' as any }, logger);
  expect(validated.useMobileKey).toBe(false);
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('useMobileKey'));
});

it('throws when both useMobileKey and hash are configured', () => {
  expect(() =>
    validateOptions({ useMobileKey: true, hash: 'abc123' }, logger),
  ).toThrow(/secure mode .* hash .* mobile key|useMobileKey.*hash|hash.*useMobileKey/i);
});

it('does not throw when only hash is configured (client-side ID mode)', () => {
  const validated = validateOptions({ hash: 'abc123' }, logger);
  expect(validated.hash).toBe('abc123');
  expect(validated.useMobileKey).toBe(false);
});

it('does not throw when only useMobileKey: true is configured (no hash)', () => {
  const validated = validateOptions({ useMobileKey: true }, logger);
  expect(validated.useMobileKey).toBe(true);
  expect(validated.hash).toBeUndefined();
});
