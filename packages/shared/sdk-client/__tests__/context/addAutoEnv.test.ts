import {
  Crypto,
  Info,
  type LDContext,
  LDLogger,
  LDMultiKindContext,
  LDUser,
} from '@launchdarkly/js-sdk-common';

import { Configuration, ConfigurationImpl } from '../../src/configuration';
import {
  addApplicationInfo,
  addAutoEnv,
  addDeviceInfo,
  toMulti,
} from '../../src/context/addAutoEnv';
import { createBasicPlatform } from '../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: LDLogger;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

describe('automatic environment attributes', () => {
  let crypto: Crypto;
  let info: Info;
  let config: Configuration;

  beforeEach(() => {
    ({ crypto, info } = mockPlatform);
    (crypto.randomUUID as jest.Mock).mockResolvedValue('test-device-key-1');
    config = new ConfigurationImpl({ logger });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('toMulti', () => {
    const singleContext = { kind: 'user', key: 'test-user-key-1', name: 'bob' };
    const multi = toMulti(singleContext);

    expect(multi).toEqual({ kind: 'multi', user: { key: 'test-user-key-1', name: 'bob' } });
  });

  describe('addAutoEnv', () => {
    test('LDUser is unsupported', async () => {
      const user: LDUser = { key: 'legacy-user-key', name: 'bob' };
      const result = await addAutoEnv(user, mockPlatform, config);

      expect(result).toEqual(user);
    });

    test('customer provides single context of kind ld_application. should only add ld_device.', async () => {
      const context = { kind: 'ld_application', key: 'test-customer-app-key-1', name: 'test-app' };
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual({
        kind: 'multi',
        ld_application: {
          key: 'test-customer-app-key-1',
          name: 'test-app',
        },
        ld_device: {
          envAttributesVersion: '1.0',
          key: 'test-device-key-1',
          manufacturer: 'coconut',
          os: {
            family: 'orange',
            name: 'An OS',
            version: '1.0.1',
          },
        },
      });
    });

    test('customer provides multi context with an ld_application context. should only add ld_device.', async () => {
      const context = {
        kind: 'multi',
        ld_application: {
          key: 'test-customer-app-key-1',
          name: 'test-app',
        },
      } as LDMultiKindContext;
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual({
        ...context,
        ld_device: {
          envAttributesVersion: '1.0',
          key: 'test-device-key-1',
          manufacturer: 'coconut',
          os: {
            family: 'orange',
            name: 'An OS',
            version: '1.0.1',
          },
        },
      });
    });

    test('customer provides single context of kind ld_device. should only add ld_application.', async () => {
      const context = { kind: 'ld_device', key: 'test-customer-dev-key-1', name: 'test-dev' };
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual({
        kind: 'multi',
        ld_device: {
          key: 'test-customer-dev-key-1',
          name: 'test-dev',
        },
        ld_application: {
          envAttributesVersion: '1.0',
          id: 'com.testapp.ld',
          key: '1234567890123456',
          name: 'LDApplication.TestApp',
          version: '1.1.1',
        },
      });
    });

    test('customer provides multi context with ld_device context. should only add ld_application.', async () => {
      const context = {
        kind: 'multi',
        ld_device: {
          key: 'test-customer-dev-key-1',
          name: 'test-dev',
        },
      } as LDMultiKindContext;
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual({
        ...context,
        ld_application: {
          envAttributesVersion: '1.0',
          id: 'com.testapp.ld',
          key: '1234567890123456',
          name: 'LDApplication.TestApp',
          version: '1.1.1',
        },
      });
    });

    test('customer provides ld_application and ld_device contexts. no changes.', async () => {
      const context = {
        kind: 'multi',
        ld_application: {
          key: 'test-customer-app-key-1',
          name: 'test-app',
        },
        ld_device: {
          key: 'test-customer-dev-key-1',
          name: 'test-dev',
        },
      } as LDMultiKindContext;
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual(context);
    });

    test('nothing to add return context unchanged', async () => {
      info.platformData = jest.fn().mockReturnValue({});

      const context = { kind: 'user', key: 'test-user-key-1', name: 'bob' };
      const result = await addAutoEnv(context, mockPlatform, config);

      expect(result).toEqual(context);
    });

    test('single kind should be converted to multi', async () => {
      const context = { kind: 'user', key: 'test-user-key-1', name: 'bob' };

      const result = await addAutoEnv(context, mockPlatform, config);

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
          manufacturer: 'coconut',
          os: { name: 'An OS', version: '1.0.1', family: 'orange' },
        },
        user: { key: 'test-user-key-1', name: 'bob' },
      });
    });

    test('multi kind', async () => {
      const context: LDContext = {
        kind: 'multi',
        user: { key: 'test-user-key-1', name: 'bob' },
        org: { key: 'test-org-key-1', name: 'Best company' },
      };
      const result = await addAutoEnv(context, mockPlatform, config);

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
          manufacturer: 'coconut',
          os: { name: 'An OS', version: '1.0.1', family: 'orange' },
        },
      });
    });

    test('log warning when ld_application is not added', async () => {
      const context: LDContext = {
        kind: 'multi',
        org: { key: 'test-org-key-1', name: 'Best company' },
        ld_application: {
          key: 'test-customer-app-key-1',
          name: 'test-app',
        },
      };

      await addAutoEnv(context, mockPlatform, config);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/ld_application.*already exists/),
      );
    });

    test('log warning when ld_device is not added', async () => {
      const context: LDContext = {
        kind: 'multi',
        org: { key: 'test-org-key-1', name: 'Best company' },
        ld_device: {
          key: 'test-customer-dev-key-1',
          name: 'test-dev',
        },
      };

      await addAutoEnv(context, mockPlatform, config);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/ld_device.*already exists/));
    });

    test('single context with an attribute called ld_application should have auto env attributes', async () => {
      const context: LDContext = {
        kind: 'user',
        key: 'test-user-key-1',
        name: 'bob',
        ld_application: {
          key: 'test-customer-app-key-1',
          name: 'test-dev',
        },
      };

      const result = await addAutoEnv(context, mockPlatform, config);

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
          manufacturer: 'coconut',
          os: { name: 'An OS', version: '1.0.1', family: 'orange' },
        },
        user: {
          key: 'test-user-key-1',
          name: 'bob',
          ld_application: {
            key: 'test-customer-app-key-1',
            name: 'test-dev',
          },
        },
      });
    });

    test('single context with an attribute called ld_device should have auto env attributes', async () => {
      const context: LDContext = {
        kind: 'user',
        key: 'test-user-key-1',
        name: 'bob',
        ld_device: {
          key: 'test-customer-dev-key-1',
          name: 'test-dev',
        },
      };

      const result = await addAutoEnv(context, mockPlatform, config);

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
          manufacturer: 'coconut',
          os: { name: 'An OS', version: '1.0.1', family: 'orange' },
        },
        user: {
          key: 'test-user-key-1',
          name: 'bob',
          ld_device: {
            key: 'test-customer-dev-key-1',
            name: 'test-dev',
          },
        },
      });
    });
  });

  describe('addApplicationInfo', () => {
    test('add id, version, name, versionName', async () => {
      config = new ConfigurationImpl({
        applicationInfo: {
          id: 'com.from-config.ld',
          version: '2.2.2',
          name: 'test-ld-app-name',
          versionName: 'test-ld-version-name',
        },
      });
      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toEqual({
        envAttributesVersion: '1.0',
        id: 'com.from-config.ld',
        key: '1234567890123456',
        name: 'test-ld-app-name',
        version: '2.2.2',
        versionName: 'test-ld-version-name',
      });
    });

    test('add auto env application id, name, version', async () => {
      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toEqual({
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        key: '1234567890123456',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      });
    });

    test('final return value should not contain falsy values', async () => {
      const mockData = info.platformData();
      info.platformData = jest.fn().mockReturnValueOnce({
        ...mockData,
        ld_application: {
          ...mockData.ld_application,
          name: '',
          version: null,
          versionName: undefined,
          locale: '',
          envAttributesVersion: 0,
        },
      });

      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toEqual({
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        key: '1234567890123456',
      });
    });

    test('omit if customer and auto env data are unavailable', async () => {
      info.platformData = jest.fn().mockReturnValueOnce({});

      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toBeUndefined();
    });

    test('omit if customer unavailable and auto env data are falsy', async () => {
      const mockData = info.platformData();
      info.platformData = jest.fn().mockReturnValueOnce({
        ld_application: {
          ...mockData.ld_application,
          name: '',
          version: null,
          id: undefined,
        },
      });

      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toBeUndefined();
    });

    test('omit if customer data is unavailable and auto env data only contains key and attributesVersion', async () => {
      info.platformData = jest.fn().mockReturnValueOnce({
        ld_application: { key: 'key-from-sdk', envAttributesVersion: '0.0.1' },
      });

      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toBeUndefined();
    });

    test('omit if no id specified', async () => {
      info.platformData = jest
        .fn()
        .mockReturnValueOnce({ ld_application: { version: null, locale: '' } });
      config = new ConfigurationImpl({ applicationInfo: { version: '1.2.3' } });
      const ldApplication = await addApplicationInfo(mockPlatform, config);

      expect(ldApplication).toBeUndefined();
    });
  });

  describe('addDeviceInfo', () => {
    test('add platformData os name, version', async () => {
      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toEqual({
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'coconut',
        os: { name: 'An OS', version: '1.0.1', family: 'orange' },
      });
    });

    test('add auto env os name, version', async () => {
      const platformData = info.platformData();
      delete platformData.os;
      info.platformData = jest.fn().mockReturnValueOnce(platformData);

      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toEqual({
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'coconut',
        os: { name: 'Another OS', version: '99', family: 'orange' },
      });
    });

    test('add auto env os name, version when platform data are empty strings', async () => {
      const platformData = info.platformData();
      platformData.os = { name: '', version: '' };
      info.platformData = jest.fn().mockReturnValueOnce(platformData);

      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toEqual({
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'coconut',
        os: { name: 'Another OS', version: '99', family: 'orange' },
      });
    });

    test('no data return undefined', async () => {
      info.platformData = jest.fn().mockReturnValueOnce({});
      const ldDevice = await addDeviceInfo(mockPlatform);
      expect(ldDevice).toBeUndefined();
    });

    test('platformData os is defined but empty', async () => {
      const platformData = info.platformData();
      platformData.os = {};
      info.platformData = jest.fn().mockReturnValueOnce(platformData);

      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toEqual({
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        manufacturer: 'coconut',
        os: { name: 'Another OS', version: '99', family: 'orange' },
      });
    });

    test('only os family is defined', async () => {
      info.platformData = jest
        .fn()
        .mockReturnValueOnce({ os: {}, ld_device: { os: { family: 'orange' } } });

      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toEqual({
        envAttributesVersion: '1.0',
        key: 'test-device-key-1',
        os: { family: 'orange' },
      });
    });

    test('return undefined when device only contains key and envAttributesVersion', async () => {
      info.platformData = jest.fn().mockReturnValueOnce({
        os: {},
        ld_device: { key: 'test-device-key', envAttributesVersion: '0.1' },
      });

      const ldDevice = await addDeviceInfo(mockPlatform);

      expect(ldDevice).toBeUndefined();
    });
  });
});
