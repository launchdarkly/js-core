import * as os from 'os';

import NodeInfo from '../../src/platform/NodeInfo';

const realOs = jest.requireActual('os');

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    platform: jest.fn(actual.platform),
    release: jest.fn(actual.release),
    arch: jest.fn(actual.arch),
  };
});

const mockedOs = jest.mocked(os);

afterEach(() => {
  mockedOs.platform.mockImplementation(realOs.platform);
  mockedOs.release.mockImplementation(realOs.release);
  mockedOs.arch.mockImplementation(realOs.arch);
});

it('returns sdk data with the package name, version, and user-agent base', () => {
  const info = new NodeInfo();
  expect(info.sdkData()).toEqual({
    name: 'node-client-sdk',
    version: '0.0.1',
    userAgentBase: 'NodeClient',
  });
});

it('reports the runtime node version under platformData additional', () => {
  const info = new NodeInfo();
  const data = info.platformData();
  expect(data.name).toBe('Node');
  expect(data.additional?.nodeVersion).toBe(process.versions.node);
});

it.each([
  ['darwin', 'MacOS'],
  ['win32', 'Windows'],
  ['linux', 'Linux'],
])('maps the %s os platform to %s', (raw, mapped) => {
  mockedOs.platform.mockReturnValue(raw as NodeJS.Platform);
  mockedOs.release.mockReturnValue('1.2.3');
  mockedOs.arch.mockReturnValue('x64');

  const info = new NodeInfo();
  expect(info.platformData().os).toEqual({ name: mapped, version: '1.2.3', arch: 'x64' });
});

it('passes through an unknown os platform name', () => {
  mockedOs.platform.mockReturnValue('freebsd' as NodeJS.Platform);
  mockedOs.release.mockReturnValue('14.0');
  mockedOs.arch.mockReturnValue('arm64');

  const info = new NodeInfo();
  expect(info.platformData().os).toEqual({ name: 'freebsd', version: '14.0', arch: 'arm64' });
});
