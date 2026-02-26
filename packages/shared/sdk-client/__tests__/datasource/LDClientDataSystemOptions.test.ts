import {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  ELECTRON_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
} from '../../src/datasource/LDClientDataSystemOptions';

it('defines browser defaults with one-shot initial mode', () => {
  expect(BROWSER_DATA_SYSTEM_DEFAULTS.initialConnectionMode).toBe('one-shot');
  expect(BROWSER_DATA_SYSTEM_DEFAULTS.automaticModeSwitching).toBe(false);
  expect(BROWSER_DATA_SYSTEM_DEFAULTS.backgroundConnectionMode).toBeUndefined();
});

it('defines mobile defaults with streaming initial mode and background mode', () => {
  expect(MOBILE_DATA_SYSTEM_DEFAULTS.initialConnectionMode).toBe('streaming');
  expect(MOBILE_DATA_SYSTEM_DEFAULTS.backgroundConnectionMode).toBe('background');
  expect(MOBILE_DATA_SYSTEM_DEFAULTS.automaticModeSwitching).toBe(true);
});

it('defines electron defaults with streaming initial mode', () => {
  expect(ELECTRON_DATA_SYSTEM_DEFAULTS.initialConnectionMode).toBe('streaming');
  expect(ELECTRON_DATA_SYSTEM_DEFAULTS.automaticModeSwitching).toBe(false);
  expect(ELECTRON_DATA_SYSTEM_DEFAULTS.backgroundConnectionMode).toBeUndefined();
});
