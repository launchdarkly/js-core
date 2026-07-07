import {
  InitializerEntry,
  LDLogger,
  LDOptions,
  ModeDefinition,
  SynchronizerEntry,
} from '@launchdarkly/js-client-sdk';
import {
  CommandParams,
  CommandType,
  CreateInstanceParams,
  makeLogger,
  SDKConfigDataInitializer,
  SDKConfigDataSynchronizer,
  SDKConfigModeDefinition,
  SDKConfigParams,
  ClientSideTestHook as TestHook,
  ValueType,
} from '@launchdarkly/js-contract-test-utils/client';
import { createClient, type LDVueClient } from '@launchdarkly/vue-client-sdk';

export const badCommandError = new Error('unsupported command');
export const malformedCommand = new Error('command was malformed');

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

function makeSdkConfig(options: SDKConfigParams, tag: string) {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds! / 1000 : undefined);

  const cf: LDOptions = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
    useReport: options.clientSide.useReport ?? undefined,
    diagnosticOptOut: true,
    disableCache: true,
  };

  if (options.serviceEndpoints) {
    cf.streamUri = options.serviceEndpoints.streaming;
    cf.baseUri = options.serviceEndpoints.polling;
    cf.eventsUri = options.serviceEndpoints.events;
  }

  if (options.dataSystem?.payloadFilter) {
    cf.payloadFilterKey = options.dataSystem.payloadFilter;
  }

  if (options.dataSystem) {
    const dataSystem: any = {};

    // Helper to apply endpoint overrides from a mode definition to global URIs.
    const applyEndpointOverrides = (modeDef: SDKConfigModeDefinition) => {
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
    };

    if (options.dataSystem.connectionModeConfig) {
      const connMode = options.dataSystem.connectionModeConfig;
      dataSystem.automaticModeSwitching = connMode.initialConnectionMode
        ? { type: 'manual', initialConnectionMode: connMode.initialConnectionMode }
        : false;

      if (connMode.customConnectionModes) {
        const connectionModes: Record<string, any> = {};
        Object.entries(connMode.customConnectionModes).forEach(([modeName, modeDef]) => {
          connectionModes[modeName] = translateModeDefinition(modeDef);
          applyEndpointOverrides(modeDef);
        });
        dataSystem.connectionModes = connectionModes;
      }
    } else if (options.dataSystem.initializers || options.dataSystem.synchronizers) {
      // Top-level initializers/synchronizers (no connection modes). Wrap them
      // into a single 'streaming' connection mode for the Vue SDK.
      const modeDef: SDKConfigModeDefinition = {
        initializers: options.dataSystem.initializers,
        synchronizers: options.dataSystem.synchronizers,
      };
      dataSystem.automaticModeSwitching = {
        type: 'manual',
        initialConnectionMode: 'streaming',
      };
      dataSystem.connectionModes = {
        streaming: translateModeDefinition(modeDef),
      };
      applyEndpointOverrides(modeDef);
    }

    (cf as any).dataSystem = dataSystem;
  } else {
    if (options.polling) {
      if (options.polling.baseUri) {
        cf.baseUri = options.polling.baseUri;
      }
    }

    if (options.streaming) {
      if (options.streaming.baseUri) {
        cf.streamUri = options.streaming.baseUri;
      }
      cf.streaming = true;
      cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
    }
  }

  if (options.events) {
    if (options.events.baseUri) {
      cf.eventsUri = options.events.baseUri;
    }
    cf.allAttributesPrivate = options.events.allAttributesPrivate;
    cf.capacity = options.events.capacity;
    cf.diagnosticOptOut = !options.events.enableDiagnostics;
    cf.flushInterval = maybeTime(options.events.flushIntervalMs);
    cf.privateAttributes = options.events.globalPrivateAttributes;
  } else {
    cf.sendEvents = false;
  }

  if (options.tags) {
    cf.applicationInfo = {
      id: options.tags.applicationId,
      version: options.tags.applicationVersion,
    };
  }

  if (options.hooks) {
    cf.hooks = TestHook.forClient(options.hooks.hooks);
  }

  cf.fetchGoals = false;

  return cf;
}

function makeDefaultInitialContext() {
  return { kind: 'user', key: 'key-not-specified' };
}

type FlagChangeListener = (...args: unknown[]) => void;

export class ClientEntity {
  private readonly _listeners = new Map<string, FlagChangeListener>();

  constructor(
    private readonly _client: LDVueClient,
    private readonly _logger: LDLogger,
  ) {}

  close() {
    this._client.close();
    this._logger.info('Test ended');
  }

  async doCommand(params: CommandParams) {
    this._logger.info(`Received command: ${params.command}`);
    switch (params.command) {
      case CommandType.EvaluateFlag: {
        const evaluationParams = params.evaluate;
        if (!evaluationParams) {
          throw malformedCommand;
        }
        if (evaluationParams.detail) {
          switch (evaluationParams.valueType) {
            case ValueType.Bool:
              return this._client.boolVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as boolean,
              );
            case ValueType.Int: // Intentional fallthrough.
            case ValueType.Double:
              return this._client.numberVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as number,
              );
            case ValueType.String:
              return this._client.stringVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as string,
              );
            default:
              return this._client.variationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue,
              );
          }
        }
        switch (evaluationParams.valueType) {
          case ValueType.Bool:
            return {
              value: this._client.boolVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as boolean,
              ),
            };
          case ValueType.Int: // Intentional fallthrough.
          case ValueType.Double:
            return {
              value: this._client.numberVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as number,
              ),
            };
          case ValueType.String:
            return {
              value: this._client.stringVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as string,
              ),
            };
          default:
            return {
              value: this._client.variation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue,
              ),
            };
        }
      }

      case CommandType.EvaluateAllFlags:
        return { state: this._client.allFlags() };

      case CommandType.IdentifyEvent: {
        const identifyParams = params.identifyEvent;
        if (!identifyParams) {
          throw malformedCommand;
        }
        await this._client.identify(identifyParams.user || identifyParams.context);
        return undefined;
      }

      case CommandType.CustomEvent: {
        const customEventParams = params.customEvent;
        if (!customEventParams) {
          throw malformedCommand;
        }
        this._client.track(
          customEventParams.eventKey,
          customEventParams.data,
          customEventParams.metricValue,
        );
        return undefined;
      }

      case CommandType.FlushEvents:
        this._client.flush();
        return undefined;

      case CommandType.RegisterFlagChangeListener: {
        const pr = params.registerFlagChangeListener;
        if (!pr) {
          throw malformedCommand;
        }
        const existing = this._listeners.get(pr.listenerId);
        if (existing) {
          this._client.off('change', existing);
        }
        const handler: FlagChangeListener = (...args) => {
          const flagKeys = Array.isArray(args[1]) ? (args[1] as string[]) : [];
          flagKeys.forEach((flagKey) => {
            fetch(pr.callbackUri, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listenerId: pr.listenerId, flagKey }),
            }).catch(() => {});
          });
        };
        this._listeners.set(pr.listenerId, handler);
        this._client.on('change', handler);
        return undefined;
      }

      case CommandType.UnregisterListener: {
        const pu = params.unregisterListener;
        if (!pu) {
          throw malformedCommand;
        }
        const handler = this._listeners.get(pu.listenerId);
        if (handler) {
          this._client.off('change', handler);
          this._listeners.delete(pu.listenerId);
        }
        return undefined;
      }

      default:
        throw badCommandError;
    }
  }
}

export async function newSdkClientEntity(options: CreateInstanceParams) {
  const logger = makeLogger(options.tag);

  logger.info(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);

  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const sdkConfig = makeSdkConfig(options.configuration, options.tag);
  const initialContext =
    options.configuration.clientSide?.initialUser ||
    options.configuration.clientSide?.initialContext ||
    makeDefaultInitialContext();

  // Exercise the Vue SDK's client wrapper directly. start() resolves to the initialization result.
  const client = createClient(
    options.configuration.credential || 'unknown-env-id',
    initialContext,
    sdkConfig,
  );

  let failed = false;
  try {
    const result = await client.start({ timeout: timeout / 1000 });
    if (result.status !== 'complete') {
      failed = true;
    }
  } catch (_) {
    // start() is documented not to reject, but guard defensively.
    failed = true;
  }
  if (failed && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, logger);
}
