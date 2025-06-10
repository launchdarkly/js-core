import * as os from 'os';

import NodeInfo from '../../src/platform/NodeInfo';

describe('given an information instance', () => {
  const info = new NodeInfo({});

  it('can get platform information', () => {
    const data = info.platformData();
    expect(data.name).toEqual('Node');
    expect(data.os).toBeDefined();
    expect(data.os?.name).toBeDefined();
    expect(data.os?.version).toBeDefined();
    expect(data.os?.arch).toBeDefined();
    expect(data.additional).toBeDefined();
    expect(data.additional!.nodeVersion).toBeDefined();
  });

  it('can get SDK information', () => {
    const sdkInfo = info.sdkData();
    expect(sdkInfo.name).toBeDefined();
    expect(sdkInfo.version).toBeDefined();
    expect(sdkInfo.wrapperName).toBeUndefined();
    expect(sdkInfo.wrapperVersion).toBeUndefined();
  });
});

test('it supports wrapper name and version', () => {
  const info = new NodeInfo({ wrapperName: 'the-wrapper', wrapperVersion: 'the-version' });
  expect(info.sdkData().wrapperName).toEqual('the-wrapper');
  expect(info.sdkData().wrapperVersion).toEqual('the-version');
});

describe('given an information instance with mock data', () => {
  const info = new NodeInfo({});

  it('can get platform information', () => {
    const platformSpy = jest.spyOn(os, 'platform');
    platformSpy.mockReturnValue('darwin');

    const versionSpy = jest.spyOn(os, 'version');
    versionSpy.mockReturnValue('0.0.0');

    const archSpy = jest.spyOn(os, 'arch');
    archSpy.mockReturnValue('s390x');

    global.process = {
      ...process,
      // @ts-ignore
      versions: { node: '1.2.3' },
    };

    const data = info.platformData();
    expect(data.os).toBeDefined();
    expect(data.os?.name).toEqual('MacOS');
    expect(data.os?.version).toEqual('0.0.0');
    expect(data.os?.arch).toEqual('s390x');
    expect(data.additional!.nodeVersion).toEqual('1.2.3');
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
