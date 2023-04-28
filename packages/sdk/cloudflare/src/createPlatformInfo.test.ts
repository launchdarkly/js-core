import createPlatformInfo from './createPlatformInfo';

import { name, version } from '../package.json';

describe('Cloudflare Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Cloudflare',
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
