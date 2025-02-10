import createPlatformInfo from '../src/createPlatformInfo';

describe('Fastly Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Fastly Compute',
    });

    expect(platformData.sdkData()).toEqual({
      name: '@launchdarkly/fastly-server-sdk',
      version: '__LD_VERSION__',
      userAgentBase: 'FastlyEdgeSDK',
    });
  });
});
