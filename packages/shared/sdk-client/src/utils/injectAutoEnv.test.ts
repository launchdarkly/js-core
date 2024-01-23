import { Info, type LDContext, LDUser } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import Configuration from '../configuration';
import { injectApplication, injectAutoEnv, injectDevice, toMulti } from './injectAutoEnv';

describe('injectAutoEnv', () => {
  let crypto: Crypto;
  let info: Info;

  beforeEach(() => {
    crypto = basicPlatform.crypto;
    info = basicPlatform.info;

    (crypto.randomUUID as jest.Mock).mockResolvedValue('test-device-key-1');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('toMulti', () => {
    const singleContext = { kind: 'user', key: 'test-user-key-1', name: 'bob' };
    const multi = toMulti(singleContext);

    expect(multi).toEqual({ kind: 'multi', user: { key: 'test-user-key-1', name: 'bob' } });
  });

  test('LDUser is unsupported', async () => {
    const config = new Configuration();
    // const context = { kind: 'user', key: 'test-user-key-1', name: 'bob' };
    const user: LDUser = { key: 'legacy-user-key', name: 'bob' };
    const result = await injectAutoEnv(user, basicPlatform, config);

    expect(result).toEqual(user);
  });

  test('single kind should be converted to multi', async () => {
    const config = new Configuration();
    const context = { kind: 'user', key: 'test-user-key-1', name: 'bob' };

    const result = await injectAutoEnv(context, basicPlatform, config);

    expect(result).toEqual({
      kind: 'multi',
      ld_application: {
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        key: '1234567890123456',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      },
      ld_device: {
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'apple',
        os: { family: 'apple', name: 'iOS', version: '17.17' },
      },
      user: { key: 'test-user-key-1', name: 'bob' },
    });
  });

  test('multi kind', async () => {
    const config = new Configuration();
    const context: LDContext = {
      kind: 'multi',
      user: { key: 'test-user-key-1', name: 'bob' },
      org: { key: 'test-org-key-1', name: 'Best company' },
    };
    const result = await injectAutoEnv(context, basicPlatform, config);

    expect(result).toEqual({
      kind: 'multi',
      user: { key: 'test-user-key-1', name: 'bob' },
      org: { key: 'test-org-key-1', name: 'Best company' },
      ld_application: {
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        key: '1234567890123456',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      },
      ld_device: {
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'apple',
        os: { family: 'apple', name: 'iOS', version: '17.17' },
      },
    });
  });

  test('injectApplication with config application id, version', () => {
    const config = new Configuration({
      application: { id: 'com.from-config.ld', version: '2.2.2' },
    });
    const ldApplication = injectApplication(basicPlatform, config);

    expect(ldApplication).toEqual({
      envAttributesVersion: '1.0',
      id: 'com.from-config.ld',
      key: '1234567890123456',
      name: 'LDApplication.TestApp',
      version: '2.2.2',
    });
  });

  test('injectApplication with auto env application id, name, version', () => {
    const config = new Configuration();
    const ldApplication = injectApplication(basicPlatform, config);

    expect(ldApplication).toEqual({
      envAttributesVersion: '1.0',
      id: 'com.testapp.ld',
      key: '1234567890123456',
      name: 'LDApplication.TestApp',
      version: '1.1.1',
    });
  });

  test('injectApplication with sdk data name, version', () => {
    const platformData = basicPlatform.info.platformData();
    delete platformData.ld_application;
    delete platformData.ld_device;
    basicPlatform.info.platformData = jest.fn().mockReturnValueOnce(platformData);
    basicPlatform.info.sdkData = jest.fn().mockReturnValueOnce({
      name: 'Name from sdk data',
      version: '3.3.3',
      userAgentBase: 'TestUserAgent',
      wrapperName: 'Rapper',
      wrapperVersion: '9.9.9',
    });

    const config = new Configuration();
    const ldApplication = injectApplication(basicPlatform, config);

    expect(ldApplication).toEqual({
      envAttributesVersion: '1.0',
      id: 'Name from sdk data',
      key: '1234567890123456',
      name: 'Name from sdk data',
      version: '3.3.3',
    });
  });

  test('injectApplication with sdkData wrapperName, wrapperVersion', () => {
    const platformData = basicPlatform.info.platformData();
    delete platformData.ld_application;
    delete platformData.ld_device;
    basicPlatform.info.platformData = jest.fn().mockReturnValueOnce(platformData);
    basicPlatform.info.sdkData = jest.fn().mockReturnValueOnce({
      name: '',
      version: '',
      userAgentBase: 'TestUserAgent',
      wrapperName: 'Rapper',
      wrapperVersion: '9.9.9',
    });

    const config = new Configuration();
    const ldApplication = injectApplication(basicPlatform, config);

    expect(ldApplication).toEqual({
      envAttributesVersion: '1.0',
      id: 'Rapper',
      key: '1234567890123456',
      name: 'Rapper',
      version: '9.9.9',
    });
  });

  test('injectDevice with platformData os name, version', async () => {
    const ldDevice = await injectDevice(basicPlatform);

    expect(ldDevice).toEqual({
      envAttributesVersion: '1.0',
      key: 'test-device-key-1',
      manufacturer: 'apple',
      os: {
        family: 'apple',
        name: 'iOS',
        version: '17.17',
      },
    });
  });

  test('injectDevice with auto env os name, version', async () => {
    const platformData = basicPlatform.info.platformData();
    delete platformData.os;
    basicPlatform.info.platformData = jest.fn().mockReturnValueOnce(platformData);

    const ldDevice = await injectDevice(basicPlatform);

    expect(ldDevice).toEqual({
      envAttributesVersion: '1.0',
      key: 'test-device-key-1',
      manufacturer: 'apple',
      os: {
        family: 'apple',
        name: 'ios',
        version: '17',
      },
    });
  });

  test('injectDevice with auto env os name, version when platform data are empty strings', async () => {
    const platformData = basicPlatform.info.platformData();
    platformData.os = { name: '', version: '' };
    basicPlatform.info.platformData = jest.fn().mockReturnValueOnce(platformData);

    const ldDevice = await injectDevice(basicPlatform);

    expect(ldDevice).toEqual({
      envAttributesVersion: '1.0',
      key: 'test-device-key-1',
      manufacturer: 'apple',
      os: {
        family: 'apple',
        name: 'ios',
        version: '17',
      },
    });
  });
});
