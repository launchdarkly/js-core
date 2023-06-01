import createPlatformInfo from '../../../platform/info';

const packageJson = require('../../../../package.json');

describe('Akamai Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Akamai EdgeWorker',
    });
  });

  it('sdkData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.sdkData()).toEqual({
      name: packageJson.name,
      version: packageJson.version,
    });
  });
});
