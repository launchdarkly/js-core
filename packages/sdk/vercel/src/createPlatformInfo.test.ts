import { name, version } from '../package.json';

import createPlatformInfo from './createPlatformInfo';

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
      name,
      version,
    });
  });
});
