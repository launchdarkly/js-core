import {
  createClient,
  InitializerEntry,
  LDOptions,
  ModeDefinition,
  SynchronizerEntry,
} from '@launchdarkly/js-client-sdk';
import {
  ClientEntity,
  CreateInstanceParams,
  IClientEntity,
  makeDefaultInitialContext,
  makeSdkConfig,
  SDKConfigDataInitializer,
  SDKConfigDataSynchronizer,
  SDKConfigModeDefinition,
  SDKConfigParams,
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

/**
 * Browser-specific makeSdkConfig that wraps the shared base config with
 * FDv2 data system translation and browser-specific options.
 */
function makeBrowserSdkConfig(options: SDKConfigParams, tag: string): LDOptions {
  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds! / 1000 : undefined);

  const cf = { ...makeSdkConfig(options, tag), fetchGoals: false } as LDOptions;

  if (options.dataSystem?.payloadFilter) {
    cf.payloadFilterKey = options.dataSystem.payloadFilter;
  }

  if (options.dataSystem) {
    const dataSystem: any = {};

    if (options.dataSystem.connectionModeConfig) {
      const connMode = options.dataSystem.connectionModeConfig;
      dataSystem.automaticModeSwitching = connMode.initialConnectionMode
        ? { type: 'manual', initialConnectionMode: connMode.initialConnectionMode }
        : false;

      if (connMode.customConnectionModes) {
        const connectionModes: Record<string, any> = {};
        Object.entries(connMode.customConnectionModes).forEach(([modeName, modeDef]) => {
          connectionModes[modeName] = translateModeDefinition(modeDef);

          // Per-entry endpoint overrides also set global URIs for ServiceEndpoints
          // compatibility. These override the serviceEndpoints values above.
          (modeDef.synchronizers ?? []).forEach((sync) => {
            if (sync.streaming?.baseUri) {
              cf.streamUri = sync.streaming.baseUri;
              cf.streamInitialReconnectDelay = maybeTime(sync.streaming.initialRetryDelayMs);
            }
            if (sync.polling?.baseUri) {
              cf.baseUri = sync.polling.baseUri;
            }
          });
          (modeDef.initializers ?? []).forEach((init) => {
            if (init.polling?.baseUri) {
              cf.baseUri = init.polling.baseUri;
            }
          });
        });
        dataSystem.connectionModes = connectionModes;
      }
    }

    (cf as any).dataSystem = dataSystem;
  }

  return cf;
}

export async function newSdkClientEntity(
  _id: string,
  options: CreateInstanceParams,
): Promise<IClientEntity> {
  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;

  const sdkConfig = makeBrowserSdkConfig(options.configuration, options.tag);
  const initialContext =
    options.configuration.clientSide?.initialUser ||
    options.configuration.clientSide?.initialContext ||
    makeDefaultInitialContext();

  const client = createClient(
    options.configuration.credential || 'unknown-env-id',
    initialContext,
    sdkConfig,
  );

  let failed = false;
  try {
    await Promise.race([
      client.start(),
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
