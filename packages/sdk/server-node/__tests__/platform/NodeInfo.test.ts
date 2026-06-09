import * as os from 'os';

import NodeInfo from '../../src/platform/NodeInfo';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
  version: jest.fn(),
  arch: jest.fn(),
}));

const actualOs = jest.requireActual<typeof os>('os');

// Restore real os implementations before each test so non-mock tests still work.
// Mock tests override these per-test with mockReturnValue.
beforeEach(() => {
  (os.platform as jest.Mock).mockImplementation(actualOs.platform);
  (os.version as jest.Mock).mockImplementation(actualOs.version);
  (os.arch as jest.Mock).mockImplementation(actualOs.arch);
});

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('can get platform information', () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.version as jest.Mock).mockReturnValue('0.0.0');
    (os.arch as jest.Mock).mockReturnValue('s390x');

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
    (os.platform as jest.Mock).mockReturnValue(platform);

    const data = info.platformData();
    expect(data.os).toBeDefined();
    expect(data.os?.name).toEqual(processed);
  });
});
