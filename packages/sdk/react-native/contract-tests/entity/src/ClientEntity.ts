import {
  ClientEntity,
  ConfigBuilder,
  CreateInstanceParams,
  IClientEntity,
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
  const config = new ConfigBuilder(options).skip('streaming').set({
    automaticNetworkHandling: false,
    automaticBackgroundHandling: false,
    ...(options.configuration.polling && { initialConnectionMode: 'polling' }),
    ...(options.configuration.streaming && { initialConnectionMode: 'streaming' }),
  });

  const autoEnvAttributes = options.configuration.clientSide?.includeEnvironmentAttributes
    ? AutoEnvAttributes.Enabled
    : AutoEnvAttributes.Disabled;

  const client = new ReactNativeLDClient(
    options.configuration.credential || 'unknown-mobile-key',
    autoEnvAttributes,
    config.build() as LDOptions,
  );

  let failed = false;
  try {
    await Promise.race([
      client.identify(config.initialContext as LDContext, {
        timeout: config.timeout / 1000,
        waitForNetworkResults: true,
      }),
      new Promise((_resolve, reject) => {
        setTimeout(reject, config.timeout);
      }),
    ]);
  } catch (_) {
    failed = true;
  }
  if (failed && !config.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, config.tag);
}
