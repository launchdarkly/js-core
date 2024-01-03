import { by, device, element, expect, waitFor } from 'detox';

describe('Example', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        detoxURLBlacklistRegex: '\\("^https://clientstream.launchdarkly.com/meval"\\)',
      },
    });
  });

  // For speed, all tests are sequential and dependent.
  // beforeEach(async () => {
  //   await device.reloadReactNative();
  // });

  test('app loads and renders correctly', async () => {
    await expect(element(by.text(/welcome to launchdarkly/i))).toBeVisible();
    await expect(element(by.text(/my-boolean-flag-1: false/i))).toBeVisible();
  });

  test('identify', async () => {
    await element(by.id('userKey')).typeText('test-user');
    await element(by.text(/identify/i)).tap();

    await waitFor(element(by.text(/my-boolean-flag-1: true/i)))
      .toBeVisible()
      .withTimeout(2000);
  });

  test('variation', async () => {
    await element(by.id('flagKey')).replaceText('my-boolean-flag-2');
    await element(by.text(/get flag value/i)).tap();

    await waitFor(element(by.text(/my-boolean-flag-2: true/i)))
      .toBeVisible()
      .withTimeout(2000);
  });
});
