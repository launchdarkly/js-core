import { Info } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import Configuration from '../configuration';
import { injectApplication, injectDevice, toMulti } from './injectAutoEnv';

describe('injectAutoEnv', () => {
  let crypto: Crypto;
  let info: Info;

  beforeEach(() => {
    crypto = basicPlatform.crypto;
    info = basicPlatform.info;

    (crypto.randomUUID as jest.Mock).mockResolvedValue('test-org-key-1');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('toMulti', () => {
    const singleContext = { kind: 'user', key: 'test-user-key-1', name: 'bob' };
    const multi = toMulti(singleContext);

    expect(multi).toEqual({ kind: 'multi', user: { key: 'test-user-key-1', name: 'bob' } });
  });

  test.todo('injectApplication uses user config application id');
  test.todo('injectApplication uses sdkData name');
  test.todo('injectApplication uses sdkData wrapperName');
  test('injectApplication uses auto env ld_application id, name and version', () => {
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

  test.todo('injectDevice uses platformData os name and version');
  test('injectDevice use auto env os name and version', async () => {
    const config = new Configuration();
    const ldDevice = await injectDevice(basicPlatform);

    expect(ldDevice).toEqual({
      envAttributesVersion: '1.0',
      key: 'test-org-key-1',
      manufacturer: 'apple',
      os: {
        family: 'apple',
        name: 'iOS',
        version: '17.17',
      },
    });
  });
});
