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
