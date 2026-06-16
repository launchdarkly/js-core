import type { NodeOptions } from '../src/NodeOptions';
import validateOptions, { filterToBaseOptions, ValidatedOptions } from '../src/options';
import { createMockLogger } from './testHelpers';

// A value no option validator should accept regardless of the field's expected type
const BOGUS_VALUE = Symbol('invalid-option-value');

// Exhaustive over keyof ValidatedOptions: adding a new node-specific option fails to compile
// here until a bogus case is added, which forces the wrong-type-warning test below to cover
// it.
const wrongTypedOptions: Record<keyof ValidatedOptions, unknown> = {
  tlsParams: BOGUS_VALUE,
  enableEventCompression: BOGUS_VALUE,
  initialConnectionMode: BOGUS_VALUE,
  plugins: BOGUS_VALUE,
  localStoragePath: BOGUS_VALUE,
  hash: BOGUS_VALUE,
  wrapperName: BOGUS_VALUE,
  wrapperVersion: BOGUS_VALUE,
};

const nodeOptionKeys = Object.keys(wrongTypedOptions) as (keyof ValidatedOptions)[];

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
  expect(out.hash).toBeUndefined();
  expect(out.wrapperName).toBeUndefined();
  expect(out.wrapperVersion).toBeUndefined();
  expect(logger.warn).not.toHaveBeenCalled();
});

it('passes through valid node-specific options', () => {
  const out = validateOptions(
    {
      initialConnectionMode: 'polling',
      enableEventCompression: true,
      localStoragePath: '/tmp/ld-cache',
      hash: 'abc123',
    },
    logger,
  );

  expect(out.initialConnectionMode).toBe('polling');
  expect(out.enableEventCompression).toBe(true);
  expect(out.localStoragePath).toBe('/tmp/ld-cache');
  expect(out.hash).toBe('abc123');
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

it('strips every node-specific option from the base options but keeps base options', () => {
  const opts: NodeOptions = {
    initialConnectionMode: 'polling',
    plugins: [],
    tlsParams: {},
    enableEventCompression: true,
    localStoragePath: '/tmp/ld-cache',
    hash: 'abc123',
    sendEvents: false,
  };

  const base = filterToBaseOptions(opts) as Record<string, unknown>;

  nodeOptionKeys.forEach((key) => {
    expect(base).not.toHaveProperty(key);
  });
  expect(base).toHaveProperty('sendEvents', false);
});

it('warns for every validated option when given a value of the wrong type', () => {
  nodeOptionKeys.forEach((key) => {
    const fieldLogger = createMockLogger();
    validateOptions({ [key]: wrongTypedOptions[key] } as unknown as NodeOptions, fieldLogger);

    expect(fieldLogger.warn).toHaveBeenCalledWith(expect.stringContaining(key));
  });
});
