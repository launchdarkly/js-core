import {
  CommandParams,
  CommandType,
  CreateInstanceParams,
  SDKConfigParams,
  ValueType,
} from '@launchdarkly/js-contract-test-utils';
import { createClient, LDClient, LDContext, LDOptions } from '@launchdarkly/node-client-sdk';

import { Log, sdkLogger } from './log.js';

const badCommandError = new Error('unsupported command');
const malformedCommand = new Error('command was malformed');
export { badCommandError };

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
  };

  if (options.serviceEndpoints) {
    cf.streamUri = options.serviceEndpoints.streaming;
    cf.baseUri = options.serviceEndpoints.polling;
    cf.eventsUri = options.serviceEndpoints.events;
  }

  if (options.streaming) {
    if (options.streaming.baseUri) {
      cf.streamUri = options.streaming.baseUri;
    }
    cf.initialConnectionMode = 'streaming';
    cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
  }

  if (options.polling) {
    if (options.polling.baseUri) {
      cf.baseUri = options.polling.baseUri;
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

  return cf;
}

function makeDefaultInitialContext(): LDContext {
  return { kind: 'user', key: 'key-not-specified' };
}

export interface SdkClientEntity {
  close: () => Promise<void>;
  doCommand: (params: CommandParams) => Promise<any>;
}

export async function newSdkClientEntity(options: CreateInstanceParams): Promise<SdkClientEntity> {
  const c: any = {};
  const log = Log(options.tag);

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

      default:
        throw badCommandError;
    }
  };

  return c;
}
