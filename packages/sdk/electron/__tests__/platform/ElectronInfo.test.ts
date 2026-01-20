import * as os from 'os';

import ElectronInfo from '../../src/platform/ElectronInfo';

describe('given an information instance', () => {
  const info = new ElectronInfo();

  it('can get platform information', () => {
    global.process = {
      ...process,
      // @ts-ignore
      versions: { node: '1.2.3', electron: '4.5.6' },
    };

    const data = info.platformData();
    expect(data.name).toEqual('Electron');
    expect(data.os).toBeDefined();
    expect(data.os?.name).toBeDefined();
    expect(data.os?.version).toBeDefined();
    expect(data.os?.arch).toBeDefined();
    expect(data.additional).toBeDefined();
    expect(data.additional!.nodeVersion).toBeDefined();
    expect(data.additional!.electronVersion).toBeDefined();
  });

  it('can get SDK information', () => {
    const sdkInfo = info.sdkData();
    expect(sdkInfo.name).toBeDefined();
    expect(sdkInfo.version).toBeDefined();
    expect(sdkInfo.userAgentBase).toBeDefined();
  });
});

describe('given an information instance with mock data', () => {
  const info = new ElectronInfo();

  it('can get platform information', () => {
    const platformSpy = jest.spyOn(os, 'platform');
    platformSpy.mockReturnValue('darwin');

    const releaseSpy = jest.spyOn(os, 'release');
    releaseSpy.mockReturnValue('0.0.0');

    const archSpy = jest.spyOn(os, 'arch');
    archSpy.mockReturnValue('x64');

    global.process = {
      ...process,
      // @ts-ignore
      versions: { node: '1.2.3', electron: '4.5.6' },
    };

    const data = info.platformData();
    expect(data.os).toBeDefined();
    expect(data.os?.name).toEqual('MacOS');
    expect(data.os?.version).toEqual('0.0.0');
    expect(data.os?.arch).toEqual('x64');
    expect(data.additional!.nodeVersion).toEqual('1.2.3');
    expect(data.additional!.electronVersion).toEqual('4.5.6');
  });

  it.each([
    ['darwin', 'MacOS'],
    ['win32', 'Windows'],
    ['linux', 'Linux'],
    ['some_os', 'some_os'],
  ])('handles known platforms', (platform, processed) => {
    const platformSpy = jest.spyOn(os, 'platform');
    // @ts-ignore
    platformSpy.mockReturnValue(platform);

    const data = info.platformData();
    expect(data.os).toBeDefined();
    expect(data.os?.name).toEqual(processed);
  });
});
