import createPlatformInfo from '../src/createPlatformInfo';

const packageJson = require('../package.json');

describe('Vercel Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Vercel Edge',
    });
  });

  it('sdkData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.sdkData().name).toEqual(packageJson.name);
  });
});
