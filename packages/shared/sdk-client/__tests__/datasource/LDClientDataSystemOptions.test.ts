import {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
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

it('defines desktop defaults with streaming initial mode', () => {
  expect(DESKTOP_DATA_SYSTEM_DEFAULTS.initialConnectionMode).toBe('streaming');
  expect(DESKTOP_DATA_SYSTEM_DEFAULTS.automaticModeSwitching).toBe(false);
  expect(DESKTOP_DATA_SYSTEM_DEFAULTS.backgroundConnectionMode).toBeUndefined();
});
