import * as os from 'os';

import ElectronInfo from '../../src/platform/ElectronInfo';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
  release: jest.fn(),
  arch: jest.fn(),
}));

const actualOs = jest.requireActual<typeof os>('os');

// Restore real os implementations before each test so non-mock tests still work.
// Mock tests override these per-test with mockReturnValue.
beforeEach(() => {
  (os.platform as jest.Mock).mockImplementation(actualOs.platform);
  (os.release as jest.Mock).mockImplementation(actualOs.release);
  (os.arch as jest.Mock).mockImplementation(actualOs.arch);
});

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('can get platform information', () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.release as jest.Mock).mockReturnValue('0.0.0');
    (os.arch as jest.Mock).mockReturnValue('x64');

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
    (os.platform as jest.Mock).mockReturnValue(platform);

    const data = info.platformData();
    expect(data.os).toBeDefined();
    expect(data.os?.name).toEqual(processed);
  });
});
