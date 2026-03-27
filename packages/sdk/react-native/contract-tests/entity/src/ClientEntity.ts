import {
  ClientEntity,
  CreateInstanceParams,
  IClientEntity,
  parseClientOptions,
} from '@launchdarkly/js-contract-test-utils/client';
import {
  AutoEnvAttributes,
  LDContext,
  LDOptions,
  ReactNativeLDClient,
} from '@launchdarkly/react-native-client-sdk';

export async function newSdkClientEntity(
  _id: string,
  options: CreateInstanceParams,
): Promise<IClientEntity> {
  const { timeout, sdkConfig, initialContext, initCanFail } = parseClientOptions(options);

  // Add RN-specific options
  const rnConfig: LDOptions = {
    ...sdkConfig,
    automaticNetworkHandling: false,
    automaticBackgroundHandling: false,
  } as LDOptions;

  // RN uses initialConnectionMode instead of streaming boolean
  if (options.configuration.polling) {
    rnConfig.initialConnectionMode = 'polling';
  }
  if (options.configuration.streaming) {
    rnConfig.initialConnectionMode = 'streaming';
  }
  // Remove the browser-style streaming field — RN doesn't use it
  delete (rnConfig as Record<string, unknown>).streaming;

  const autoEnvAttributes = options.configuration.clientSide?.includeEnvironmentAttributes
    ? AutoEnvAttributes.Enabled
    : AutoEnvAttributes.Disabled;

  const client = new ReactNativeLDClient(
    options.configuration.credential || 'unknown-mobile-key',
    autoEnvAttributes,
    rnConfig,
  );

  let failed = false;
  try {
    await Promise.race([
      client.identify(initialContext as LDContext, {
        timeout: timeout / 1000,
        waitForNetworkResults: true,
      }),
      new Promise((_resolve, reject) => {
        setTimeout(reject, timeout);
      }),
    ]);
  } catch (_) {
    failed = true;
  }
  if (failed && !initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, options.tag);
}
