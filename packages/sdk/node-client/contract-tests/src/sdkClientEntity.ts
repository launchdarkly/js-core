import * as fs from 'fs';

import {
  CommandParams,
  CommandType,
  CreateInstanceParams,
  SDKConfigDataInitializer,
  SDKConfigDataSynchronizer,
  SDKConfigModeDefinition,
  SDKConfigParams,
  ValueType,
} from '@launchdarkly/js-contract-test-utils';
import { ClientSideTestHook as TestHook } from '@launchdarkly/js-contract-test-utils/client';
import {
  createClient,
  InitializerEntry,
  LDClient,
  LDContext,
  LDOptions,
  ModeDefinition,
  SynchronizerEntry,
} from '@launchdarkly/node-client-sdk';

import { Log, sdkLogger } from './log.js';

const badCommandError = new Error('unsupported command');
const malformedCommand = new Error('command was malformed');
export { badCommandError };

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

function makeSdkConfig(options: SDKConfigParams, tag: string): LDOptions {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? (seconds as number) / 1000 : undefined);

  const cf: LDOptions = {
    logger: sdkLogger(tag),
    diagnosticOptOut: true,
    withReasons: options.clientSide.evaluationReasons,
    useReport: options.clientSide.useReport ?? undefined,
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
    const dataSystem: Record<string, any> = {};

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
        const connectionModes: Record<string, ModeDefinition> = {};
        Object.entries(connMode.customConnectionModes).forEach(([modeName, modeDef]) => {
          connectionModes[modeName] = translateModeDefinition(modeDef);
          applyEndpointOverrides(modeDef);
        });
        dataSystem.connectionModes = connectionModes;
      }
    } else if (options.dataSystem.initializers || options.dataSystem.synchronizers) {
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
    if (options.streaming) {
      if (options.streaming.baseUri) {
        cf.streamUri = options.streaming.baseUri;
      }
      cf.initialConnectionMode = 'streaming';
      cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
    } else if (options.polling) {
      cf.initialConnectionMode = 'polling';
    }

    if (options.polling) {
      if (options.polling.baseUri) {
        cf.baseUri = options.polling.baseUri;
      }
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
    if (options.events.enableGzip) {
      cf.enableEventCompression = true;
    }
  } else {
    cf.sendEvents = false;
  }

  if (options.tls) {
    cf.tlsParams = {};
    if (options.tls.skipVerifyPeer) {
      cf.tlsParams.rejectUnauthorized = false;
    }
    if (options.tls.customCAFile) {
      cf.tlsParams.ca = fs.readFileSync(options.tls.customCAFile);
    }
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

  if (options.wrapper) {
    if (options.wrapper.name) {
      cf.wrapperName = options.wrapper.name;
    }
    if (options.wrapper.version) {
      cf.wrapperVersion = options.wrapper.version;
    }
  }

  return cf;
}

function makeDefaultInitialContext(): LDContext {
  return { kind: 'user', key: 'key-not-specified' };
}

export interface SdkClientEntity {
  close: () => Promise<void>;
  doCommand: (params: CommandParams) => Promise<any>;
}

type FlagChangeListener = (...args: unknown[]) => void;

export async function newSdkClientEntity(options: CreateInstanceParams): Promise<SdkClientEntity> {
  const c: any = {};
  const log = Log(options.tag);
  const listeners = new Map<string, FlagChangeListener>();

  log.info(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);

  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const sdkConfig = makeSdkConfig(options.configuration, options.tag);
  const initialContext: LDContext =
    (options.configuration.clientSide?.initialUser as LDContext) ||
    (options.configuration.clientSide?.initialContext as LDContext) ||
    makeDefaultInitialContext();
  const client: LDClient = createClient(
    options.configuration.credential || 'unknown-env-id',
    initialContext,
    sdkConfig,
  );
  const startResult = await client.start({ timeout: timeout / 1000 });
  const failed = startResult.status !== 'complete';
  if (failed && !options.configuration.initCanFail) {
    await client.close();
    throw new Error('client initialization failed');
  }

  c.close = async () => {
    await client.close();
    log.info('Test ended');
  };

  c.doCommand = async (params: CommandParams) => {
    log.info(`Received command: ${params.command}`);
    switch (params.command) {
      case CommandType.EvaluateFlag: {
        const pe = params.evaluate;
        if (!pe) {
          throw malformedCommand;
        }
        if (pe.detail) {
          switch (pe.valueType) {
            case ValueType.Bool:
              return client.boolVariationDetail(pe.flagKey, pe.defaultValue as boolean);
            case ValueType.Int: // Intentional fallthrough.
            case ValueType.Double:
              return client.numberVariationDetail(pe.flagKey, pe.defaultValue as number);
            case ValueType.String:
              return client.stringVariationDetail(pe.flagKey, pe.defaultValue as string);
            default:
              return client.variationDetail(pe.flagKey, pe.defaultValue);
          }
        }
        switch (pe.valueType) {
          case ValueType.Bool:
            return { value: client.boolVariation(pe.flagKey, pe.defaultValue as boolean) };
          case ValueType.Int: // Intentional fallthrough.
          case ValueType.Double:
            return { value: client.numberVariation(pe.flagKey, pe.defaultValue as number) };
          case ValueType.String:
            return { value: client.stringVariation(pe.flagKey, pe.defaultValue as string) };
          default:
            return { value: client.variation(pe.flagKey, pe.defaultValue) };
        }
      }

      case CommandType.EvaluateAllFlags:
        return { state: client.allFlags() };

      case CommandType.IdentifyEvent: {
        const pi = params.identifyEvent;
        if (!pi) {
          throw malformedCommand;
        }
        await client.identify((pi.user as LDContext) || (pi.context as LDContext));
        return undefined;
      }

      case CommandType.CustomEvent: {
        const pce = params.customEvent;
        if (!pce) {
          throw malformedCommand;
        }
        client.track(pce.eventKey, pce.data, pce.metricValue);
        return undefined;
      }

      case CommandType.FlushEvents:
        client.flush();
        return undefined;

      case CommandType.RegisterFlagChangeListener: {
        const pr = params.registerFlagChangeListener;
        if (!pr) {
          throw malformedCommand;
        }
        const existing = listeners.get(pr.listenerId);
        if (existing) {
          client.off('change', existing);
        }
        const handler: FlagChangeListener = (...args) => {
          // The common-base emitter dispatches 'change' with (flagKeys: string[]).
          // Fan out one POST per flag so the harness sees individual notifications.
          const flagKeys = Array.isArray(args[0]) ? (args[0] as string[]) : [];
          flagKeys.forEach((flagKey) => {
            fetch(pr.callbackUri, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listenerId: pr.listenerId, flagKey }),
            }).catch(() => {});
          });
        };
        listeners.set(pr.listenerId, handler);
        client.on('change', handler);
        return undefined;
      }

      case CommandType.UnregisterListener: {
        const pu = params.unregisterListener;
        if (!pu) {
          throw malformedCommand;
        }
        const handler = listeners.get(pu.listenerId);
        if (handler) {
          client.off('change', handler);
          listeners.delete(pu.listenerId);
        }
        return undefined;
      }

      default:
        throw badCommandError;
    }
  };

  return c;
}
