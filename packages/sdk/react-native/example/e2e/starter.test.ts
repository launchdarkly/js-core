import { by, device, element, expect, waitFor } from 'detox';

describe('given the example application', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        // Detox will wait for HTTP requests to complete. This prevents detox from waiting for
        // requests matching this URL to complete.
        detoxURLBlacklistRegex: '\\("^https://clientstream.launchdarkly.com/meval.*"\\)',
      },
    });
  });

  it('loads and renders correctly with default values', async () => {
    await expect(element(by.text(/welcome to launchdarkly/i))).toBeVisible();
    await expect(element(by.text(/sample-feature: false/i))).toBeVisible();
  });

  it('can identify and evaluate with non-default values', async () => {
    const featureFlagKey = process.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';
    await element(by.id('userKey')).typeText('example-user-key');
    await element(by.id('flagKey')).replaceText(featureFlagKey);
    await element(by.text(/identify/i)).tap();

    await waitFor(element(by.text(new RegExp(`${featureFlagKey}: true`))))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('can set a flag and has defaults for a non-existent flag', async () => {
    await element(by.id('flagKey')).replaceText('not-found-flag');

    await waitFor(element(by.text(/not-found-flag: false/i)))
      .toBeVisible()
      .withTimeout(2000);
  });
});
