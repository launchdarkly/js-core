import {
  createClient,
  InitializerEntry,
  LDContext,
  LDOptions,
  ModeDefinition,
  SynchronizerEntry,
} from '@launchdarkly/js-client-sdk';
import {
  ClientEntity,
  ConfigBuilder,
  CreateInstanceParams,
  IClientEntity,
  SDKConfigDataInitializer,
  SDKConfigDataSynchronizer,
  SDKConfigModeDefinition,
} from '@launchdarkly/js-contract-test-utils/client';

function translateInitializer(init: SDKConfigDataInitializer): InitializerEntry | undefined {
  if (init.polling) {
    return {
      type: 'polling',
      ...(init.polling.pollIntervalMs !== undefined && {
        pollInterval: init.polling.pollIntervalMs / 1000,
      }),
      ...(init.polling.baseUri && {
        endpoints: { pollingBaseUri: init.polling.baseUri },
      }),
    };
  }
  return undefined;
}

function translateSynchronizer(sync: SDKConfigDataSynchronizer): SynchronizerEntry | undefined {
  if (sync.streaming) {
    return {
      type: 'streaming',
      ...(sync.streaming.initialRetryDelayMs !== undefined && {
        initialReconnectDelay: sync.streaming.initialRetryDelayMs / 1000,
      }),
      ...(sync.streaming.baseUri && {
        endpoints: { streamingBaseUri: sync.streaming.baseUri },
      }),
    };
  }
  if (sync.polling) {
    return {
      type: 'polling',
      ...(sync.polling.pollIntervalMs !== undefined && {
        pollInterval: sync.polling.pollIntervalMs / 1000,
      }),
      ...(sync.polling.baseUri && {
        endpoints: { pollingBaseUri: sync.polling.baseUri },
      }),
    };
  }
  return undefined;
}

function translateModeDefinition(modeDef: SDKConfigModeDefinition): ModeDefinition {
  const initializers: InitializerEntry[] = (modeDef.initializers ?? [])
    .map(translateInitializer)
    .filter((x): x is InitializerEntry => x !== undefined);

  const synchronizers: SynchronizerEntry[] = (modeDef.synchronizers ?? [])
    .map(translateSynchronizer)
    .filter((x): x is SynchronizerEntry => x !== undefined);

  return { initializers, synchronizers };
}

export async function newSdkClientEntity(
  _id: string,
  options: CreateInstanceParams,
): Promise<IClientEntity> {
  const config = new ConfigBuilder(options).set({ fetchGoals: false });

  if (options.configuration.dataSystem) {
    // FDv2: skip legacy streaming — data system handles connection modes
    config.skip('streaming');

    const isSet = (x?: unknown) => x !== null && x !== undefined;
    const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds! / 1000 : undefined);
    const fdv2Overrides: Record<string, unknown> = {};

    if (options.configuration.dataSystem.payloadFilter) {
      fdv2Overrides.payloadFilterKey = options.configuration.dataSystem.payloadFilter;
    }

    const dataSystem: any = {};

    if (options.configuration.dataSystem.connectionModeConfig) {
      const connMode = options.configuration.dataSystem.connectionModeConfig;
      dataSystem.automaticModeSwitching = connMode.initialConnectionMode
        ? { type: 'manual', initialConnectionMode: connMode.initialConnectionMode }
        : false;

      if (connMode.customConnectionModes) {
        const connectionModes: Record<string, any> = {};
        Object.entries(connMode.customConnectionModes).forEach(([modeName, modeDef]) => {
          connectionModes[modeName] = translateModeDefinition(modeDef);

          (modeDef.synchronizers ?? []).forEach((sync) => {
            if (sync.streaming?.baseUri) {
              fdv2Overrides.streamUri = sync.streaming.baseUri;
              fdv2Overrides.streamInitialReconnectDelay = maybeTime(
                sync.streaming.initialRetryDelayMs,
              );
            }
            if (sync.polling?.baseUri) {
              fdv2Overrides.baseUri = sync.polling.baseUri;
            }
          });
          (modeDef.initializers ?? []).forEach((init) => {
            if (init.polling?.baseUri) {
              fdv2Overrides.baseUri = init.polling.baseUri;
            }
          });
        });
        dataSystem.connectionModes = connectionModes;
      }
    }

    fdv2Overrides.dataSystem = dataSystem;
    config.set(fdv2Overrides);
  }

  const sdkConfig = config.build() as LDOptions;
  const client = createClient(config.credential, config.initialContext as LDContext, sdkConfig);

  let failed = false;
  try {
    await Promise.race([
      client.start(),
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
