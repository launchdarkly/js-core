import { isDocument, isWindow } from '../src/BrowserApi';

it('isDocument returns true when document is defined', () => {
  expect(isDocument()).toBe(true);
});

it('isDocument returns false when document is not defined', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true });
  try {
    expect(isDocument()).toBe(false);
  } finally {
    Object.defineProperty(globalThis, 'document', original!);
  }
});

it('isWindow returns true when window is defined', () => {
  expect(isWindow()).toBe(true);
});

it('isWindow returns false when window is not defined', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });
  try {
    expect(isWindow()).toBe(false);
  } finally {
    Object.defineProperty(globalThis, 'window', original!);
  }
});
