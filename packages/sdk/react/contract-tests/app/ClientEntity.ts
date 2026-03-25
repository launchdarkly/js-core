'use client';

import { useEffect } from 'react';

import {
  CommandParams,
  CommandType,
  makeLogger,
  SDKConfigParams,
  ClientSideTestHook as TestHook,
  ValueType,
} from '@launchdarkly/js-contract-test-utils/client';
import { LDOptions, LDReactClient, useLDClient } from '@launchdarkly/react-sdk';

export const badCommandError = new Error('unsupported command');
export const malformedCommand = new Error('command was malformed');

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
    cf.hooks = options.hooks.hooks.map(
      (hook) => new TestHook(hook.name, hook.callbackUri, hook.data, hook.errors),
    );
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
