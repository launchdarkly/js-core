import createPlatformInfo from './createPlatformInfo';

import packageJson from '../package.json';

describe('Vercel Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Vercel Edge',
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
