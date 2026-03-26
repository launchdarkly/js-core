import {
  ClientEntity,
  CreateInstanceParams,
  IClientEntity,
  makeDefaultInitialContext,
  makeSdkConfig,
} from '@launchdarkly/js-contract-test-utils/client';
import {
  AutoEnvAttributes,
  LDOptions,
  ReactNativeLDClient,
} from '@launchdarkly/react-native-client-sdk';

export async function newSdkClientEntity(
  _id: string,
  options: CreateInstanceParams,
): Promise<IClientEntity> {
  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;

  // Build base config, then add RN-specific options
  const baseConfig = makeSdkConfig(options.configuration, options.tag);
  const sdkConfig: LDOptions = {
    ...baseConfig,
    automaticNetworkHandling: false,
    automaticBackgroundHandling: false,
  } as LDOptions;

  // RN uses initialConnectionMode instead of streaming boolean
  if (options.configuration.polling) {
    sdkConfig.initialConnectionMode = 'polling';
  }
  if (options.configuration.streaming) {
    sdkConfig.initialConnectionMode = 'streaming';
  }
  // Remove the browser-style streaming field — RN doesn't use it
  delete (sdkConfig as Record<string, unknown>).streaming;

  const autoEnvAttributes = options.configuration.clientSide?.includeEnvironmentAttributes
    ? AutoEnvAttributes.Enabled
    : AutoEnvAttributes.Disabled;

  const initialContext =
    options.configuration.clientSide?.initialUser ||
    options.configuration.clientSide?.initialContext ||
    makeDefaultInitialContext();

  const client = new ReactNativeLDClient(
    options.configuration.credential || 'unknown-mobile-key',
    autoEnvAttributes,
    sdkConfig,
  );

  let failed = false;
  try {
    await Promise.race([
      client.identify(initialContext, { timeout: timeout / 1000, waitForNetworkResults: true }),
      new Promise((_resolve, reject) => {
        setTimeout(reject, timeout);
      }),
    ]);
  } catch (_) {
    failed = true;
  }
  if (failed && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, options.tag);
}
