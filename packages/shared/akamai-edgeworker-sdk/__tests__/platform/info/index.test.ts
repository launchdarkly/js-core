import createPlatformInfo from '../../../src/platform/info';

const packageJson = require('../../../package.json');

describe('Akamai Platform Info', () => {
  const { name, version } = packageJson;
  const platformName = 'Akamai EdgeWorker';

  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo(platformName, name, version);

    expect(platformData.platformData()).toEqual({
      name: 'Akamai EdgeWorker',
    });
  });

  it('sdkData shows correct information', () => {
    const platformData = createPlatformInfo(platformName, name, version);

    expect(platformData.sdkData()).toEqual({
      name: packageJson.name,
      version: packageJson.version,
      userAgentBase: 'AkamaiEdgeSDK',
    });
  });
});
