import BrowserInfo from '../../src/platform/BrowserInfo';

const packageJson = require('../../package.json');

it('returns correct platform data', () => {
  const browserInfo = new BrowserInfo({});
  expect(browserInfo.platformData()).toEqual({
    name: 'JS',
  });
});

it('returns correct SDK data without wrapper info', () => {
  const browserInfo = new BrowserInfo({});
  expect(browserInfo.sdkData()).toEqual({
    name: packageJson.name,
    version: packageJson.version,
    userAgentBase: 'JSClient',
  });
});

it('returns correct SDK data with wrapper name', () => {
  const browserInfo = new BrowserInfo({ wrapperName: 'test-wrapper' });
  expect(browserInfo.sdkData()).toEqual({
    name: packageJson.name,
    version: packageJson.version,
    userAgentBase: 'JSClient',
    wrapperName: 'test-wrapper',
  });
});

it('returns correct SDK data with wrapper version', () => {
  const browserInfo = new BrowserInfo({ wrapperVersion: '1.0.0' });
  expect(browserInfo.sdkData()).toEqual({
    name: packageJson.name,
    version: packageJson.version,
    userAgentBase: 'JSClient',
    wrapperVersion: '1.0.0',
  });
});

it('returns correct SDK data with both wrapper name and version', () => {
  const browserInfo = new BrowserInfo({
    wrapperName: 'test-wrapper',
    wrapperVersion: '1.0.0',
  });
  expect(browserInfo.sdkData()).toEqual({
    name: packageJson.name,
    version: packageJson.version,
    userAgentBase: 'JSClient',
    wrapperName: 'test-wrapper',
    wrapperVersion: '1.0.0',
  });
});
