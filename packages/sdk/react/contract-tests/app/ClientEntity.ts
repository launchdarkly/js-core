'use client';

import { useEffect } from 'react';

import {
  CommandParams,
  CommandType,
  makeLogger,
  SDKConfigDataInitializer,
  SDKConfigDataSynchronizer,
  SDKConfigModeDefinition,
  SDKConfigParams,
  SDKConfigPollingParams,
  ClientSideTestHook as TestHook,
  ValueType,
} from '@launchdarkly/js-contract-test-utils/client';
import {
  InitializerEntry,
  LDOptions,
  LDReactClient,
  ModeDefinition,
  SynchronizerEntry,
  useLDClient,
} from '@launchdarkly/react-sdk';

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

function translateModeDefinition(
  modeDef: SDKConfigModeDefinition,
  fdv1Fallback?: SDKConfigPollingParams | null,
): ModeDefinition {
  const initializers: InitializerEntry[] = (modeDef.initializers ?? [])
    .map(translateInitializer)
    .filter((x): x is InitializerEntry => x !== undefined);

  const synchronizers: SynchronizerEntry[] = (modeDef.synchronizers ?? [])
    .map(translateSynchronizer)
    .filter((x): x is SynchronizerEntry => x !== undefined);

  if (fdv1Fallback) {
    return {
      initializers,
      synchronizers,
      fdv1Fallback: {
        ...(fdv1Fallback.pollIntervalMs != null && {
          pollInterval: fdv1Fallback.pollIntervalMs / 1000,
        }),
        ...(fdv1Fallback.baseUri && {
          endpoints: { pollingBaseUri: fdv1Fallback.baseUri },
        }),
      },
    };
  }

  return { initializers, synchronizers };
}

export function makeSdkConfig(options: SDKConfigParams, tag: string): LDOptions {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds! / 1000 : undefined);

  const cf: LDOptions = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
    useReport: options.clientSide.useReport,
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
        const { fdv1Fallback } = options.dataSystem;
        const connectionModes: Record<string, any> = {};
        Object.entries(connMode.customConnectionModes).forEach(([modeName, modeDef]) => {
          connectionModes[modeName] = translateModeDefinition(modeDef, fdv1Fallback);
          applyEndpointOverrides(modeDef);
        });
        dataSystem.connectionModes = connectionModes;
      }
    } else if (options.dataSystem.initializers || options.dataSystem.synchronizers) {
      // Top-level initializers/synchronizers (no connection modes). Wrap them
      // into a single 'streaming' connection mode for the React SDK.
      const modeDef: SDKConfigModeDefinition = {
        initializers: options.dataSystem.initializers,
        synchronizers: options.dataSystem.synchronizers,
      };
      dataSystem.automaticModeSwitching = {
        type: 'manual',
        initialConnectionMode: 'streaming',
      };
      dataSystem.connectionModes = {
        streaming: translateModeDefinition(modeDef, options.dataSystem.fdv1Fallback),
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

export async function doCommand(client: LDReactClient, params: CommandParams): Promise<unknown> {
  const logger = makeLogger('doCommand');
  logger.info(`Received command: ${params.command}`);

  switch (params.command) {
    case CommandType.EvaluateFlag: {
      const evaluationParams = params.evaluate;
      if (!evaluationParams) {
        throw malformedCommand;
      }
      if (evaluationParams.detail) {
        switch (evaluationParams.valueType) {
          case ValueType.Bool:
            return client.boolVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as boolean,
            );
          case ValueType.Int: // Intentional fallthrough.
          case ValueType.Double:
            return client.numberVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as number,
            );
          case ValueType.String:
            return client.stringVariationDetail(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as string,
            );
          default:
            return client.variationDetail(evaluationParams.flagKey, evaluationParams.defaultValue);
        }
      }
      switch (evaluationParams.valueType) {
        case ValueType.Bool:
          return {
            value: client.boolVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as boolean,
            ),
          };
        case ValueType.Int: // Intentional fallthrough.
        case ValueType.Double:
          return {
            value: client.numberVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as number,
            ),
          };
        case ValueType.String:
          return {
            value: client.stringVariation(
              evaluationParams.flagKey,
              evaluationParams.defaultValue as string,
            ),
          };
        default:
          return {
            value: client.variation(evaluationParams.flagKey, evaluationParams.defaultValue),
          };
      }
    }

    case CommandType.EvaluateAllFlags:
      return { state: client.allFlags() };

    case CommandType.IdentifyEvent: {
      const identifyParams = params.identifyEvent;
      if (!identifyParams) {
        throw malformedCommand;
      }
      await client.identify(identifyParams.user || identifyParams.context);
      return undefined;
    }

    case CommandType.CustomEvent: {
      const customEventParams = params.customEvent;
      if (!customEventParams) {
        throw malformedCommand;
      }
      client.track(
        customEventParams.eventKey,
        customEventParams.data,
        customEventParams.metricValue,
      );
      return undefined;
    }

    case CommandType.FlushEvents:
      client.flush();
      return undefined;

    default:
      throw badCommandError;
  }
}

export type CommandHandler = (params: CommandParams) => Promise<unknown>;

export function ClientInstance({
  clientId,
  handlers,
  onReady,
}: {
  clientId: string;
  handlers: Map<string, CommandHandler>;
  onReady: (id: string) => void;
}) {
  const client = useLDClient();

  useEffect(() => {
    handlers.set(clientId, (params) => doCommand(client, params));
    onReady(clientId);
    return () => {
      handlers.delete(clientId);
    };
  }, [client, clientId, handlers, onReady]);

  return null;
}
