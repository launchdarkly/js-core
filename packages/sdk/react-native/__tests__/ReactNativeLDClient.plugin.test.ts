import {
  AutoEnvAttributes,
  Hook,
  HookMetadata,
  LDContext,
  LDLogger,
  LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import { LDPlugin } from '../src/LDPlugin';
import PlatformCrypto from '../src/platform/crypto';
import PlatformEncoding from '../src/platform/PlatformEncoding';
import PlatformInfo from '../src/platform/PlatformInfo';
import PlatformStorage from '../src/platform/PlatformStorage';
import ReactNativeLDClient from '../src/ReactNativeLDClient';

jest.mock('../src/platform', () => ({
  __esModule: true,
  default: jest.fn((logger: LDLogger) => ({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  })),
}));

it('registers plugins and executes hooks during initialization', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    beforeIdentify: jest.fn(() => ({})),
    afterIdentify: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: () => [mockHook],
  };

  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Disabled, {
    initialConnectionMode: 'polling',
    logger,
    diagnosticOptOut: true,
    plugins: [mockPlugin],
  });

  // Verify the plugin was registered
  expect(mockPlugin.register).toHaveBeenCalled();

  // Now test that hooks work by calling identify and variation
  const context: LDContext = { key: 'user-key', kind: 'user' };
  await client.identify(context);

  expect(mockHook.beforeIdentify).toHaveBeenCalledWith({ context, timeout: undefined }, {});

  expect(mockHook.afterIdentify).toHaveBeenCalledWith(
    { context, timeout: undefined },
    {},
    { status: 'completed' },
  );

  client.variation('flag-key', false);

  expect(mockHook.beforeEvaluation).toHaveBeenCalledWith(
    { context, defaultValue: false, flagKey: 'flag-key' },
    {},
  );

  expect(mockHook.afterEvaluation).toHaveBeenCalled();

  client.track('event-key', { data: true }, 42);

  expect(mockHook.afterTrack).toHaveBeenCalledWith({
    context,
    key: 'event-key',
    data: { data: true },
    metricValue: 42,
  });
});

it('registers multiple plugins and executes all hooks', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook1: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook-1',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockHook2: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook-2',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
    afterTrack: jest.fn(() => ({})),
  };

  const mockPlugin1: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin-1' }),
    register: jest.fn(),
    getHooks: () => [mockHook1],
  };

  const mockPlugin2: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin-2' }),
    register: jest.fn(),
    getHooks: () => [mockHook2],
  };

  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Disabled, {
    initialConnectionMode: 'polling',
    logger,
    diagnosticOptOut: true,
    plugins: [mockPlugin1, mockPlugin2],
  });

  // Verify plugins were registered
  expect(mockPlugin1.register).toHaveBeenCalled();
  expect(mockPlugin2.register).toHaveBeenCalled();

  // Test that both hooks work
  await client.identify({ key: 'user-key', kind: 'user' });
  client.variation('flag-key', false);
  client.track('event-key', { data: true }, 42);

  expect(mockHook1.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook1.afterEvaluation).toHaveBeenCalled();
  expect(mockHook2.beforeEvaluation).toHaveBeenCalled();
  expect(mockHook2.afterEvaluation).toHaveBeenCalled();
  expect(mockHook1.afterTrack).toHaveBeenCalled();
  expect(mockHook2.afterTrack).toHaveBeenCalled();
});

it('passes correct environmentMetadata to plugin getHooks and register functions', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn(() => [mockHook]),
  };

  const options: LDOptions = {
    wrapperName: 'test-wrapper',
    wrapperVersion: '2.0.0',
    applicationInfo: {
      id: 'test-app',
      version: '3.0.0',
    },
  };

  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Disabled, {
    initialConnectionMode: 'polling',
    logger,
    diagnosticOptOut: true,
    plugins: [mockPlugin],
    ...options,
  });

  const platform = client.platform;
  const sdkData = platform.info.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.userAgentBase,
      version: sdkData.version,
      wrapperName: options.wrapperName,
      wrapperVersion: options.wrapperVersion,
    },
    application: {
      id: options.applicationInfo?.id,
      version: options.applicationInfo?.version,
    },
    mobileKey: 'mobile-key',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.name,
        version: sdkData.version,
        wrapperName: options.wrapperName,
        wrapperVersion: options.wrapperVersion,
      },
      application: {
        name: options.applicationInfo?.name,
        version: options.applicationInfo?.version,
      },
      mobileKey: 'mobile-key',
    }
  );
});

it('passes correct environmentMetadata without optional fields', async () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockHook: Hook = {
    getMetadata(): HookMetadata {
      return {
        name: 'test-hook',
      };
    },
    beforeEvaluation: jest.fn(() => ({})),
    afterEvaluation: jest.fn(() => ({})),
  };

  const mockPlugin: LDPlugin = {
    getMetadata: () => ({ name: 'test-plugin' }),
    register: jest.fn(),
    getHooks: jest.fn(() => [mockHook]),
  };

  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Disabled, {
    initialConnectionMode: 'polling',
    logger,
    diagnosticOptOut: true,
    plugins: [mockPlugin],
  });

  const platform = client.platform;
  const sdkData = platform.info.sdkData();
  expect(sdkData.name).toBeDefined();
  expect(sdkData.version).toBeDefined();

  // Verify getHooks was called with correct environmentMetadata
  expect(mockPlugin.getHooks).toHaveBeenCalledWith({
    sdk: {
      name: sdkData.name,
      version: sdkData.version,
    },
    mobileKey: 'mobile-key',
  });

  // Verify register was called with correct environmentMetadata
  expect(mockPlugin.register).toHaveBeenCalledWith(
    expect.any(Object), // client
    {
      sdk: {
        name: sdkData.name,
        version: sdkData.version,
      },
      mobileKey: 'mobile-key',
    }
  );
});
