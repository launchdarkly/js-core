import { ensureJsonSerializable } from '../../src/bridge/ensureJsonSerializable';

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

it('passes null through unchanged', () => {
  expect(ensureJsonSerializable(null, 'test')).toBeNull();
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes undefined through unchanged', () => {
  expect(ensureJsonSerializable(undefined, 'test')).toBeUndefined();
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes booleans through unchanged', () => {
  expect(ensureJsonSerializable(true, 'test')).toBe(true);
  expect(ensureJsonSerializable(false, 'test')).toBe(false);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes numbers through unchanged', () => {
  expect(ensureJsonSerializable(0, 'test')).toBe(0);
  expect(ensureJsonSerializable(42, 'test')).toBe(42);
  expect(ensureJsonSerializable(-1.5, 'test')).toBe(-1.5);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes strings through unchanged', () => {
  expect(ensureJsonSerializable('', 'test')).toBe('');
  expect(ensureJsonSerializable('hello', 'test')).toBe('hello');
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes plain objects through', () => {
  const obj = { a: 1, b: 'two', c: true, d: null };
  expect(ensureJsonSerializable(obj, 'test')).toBe(obj);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes arrays through', () => {
  const arr = [1, 'two', null, { nested: true }];
  expect(ensureJsonSerializable(arr, 'test')).toBe(arr);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('passes deeply nested objects through', () => {
  const nested = { a: { b: { c: { d: [1, 2, 3] } } } };
  expect(ensureJsonSerializable(nested, 'test')).toBe(nested);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('rejects functions and returns undefined with a warning', () => {
  expect(ensureJsonSerializable(() => {}, 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LaunchDarkly]'));
});

it('rejects symbols and returns undefined with a warning', () => {
  expect(ensureJsonSerializable(Symbol('test'), 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LaunchDarkly]'));
});

it('rejects circular references and returns undefined with a warning', () => {
  const circular: any = { a: 1 };
  circular.self = circular;
  expect(ensureJsonSerializable(circular, 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LaunchDarkly]'));
});

it('rejects BigInt and returns undefined with a warning', () => {
  expect(ensureJsonSerializable(BigInt(42), 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LaunchDarkly]'));
});

it('rejects objects containing function values', () => {
  const obj = { a: 1, fn: () => {} };
  expect(ensureJsonSerializable(obj, 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
});

it('rejects class instances (non-plain prototype)', () => {
  class MyClass {
    data = 'value';
  }
  expect(ensureJsonSerializable(new MyClass(), 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
});

it('rejects Date objects', () => {
  expect(ensureJsonSerializable(new Date(), 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
});

it('rejects Map and Set objects', () => {
  expect(ensureJsonSerializable(new Map(), 'test')).toBeUndefined();
  expect(ensureJsonSerializable(new Set(), 'test')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(2);
});

it('passes objects created with Object.create(null)', () => {
  const obj = Object.create(null);
  obj.a = 1;
  expect(ensureJsonSerializable(obj, 'test')).toBe(obj);
  expect(warnSpy).not.toHaveBeenCalled();
});

it('includes the label in warning messages', () => {
  ensureJsonSerializable(() => {}, 'jsonVariation defaultValue');
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('jsonVariation defaultValue'));
});
