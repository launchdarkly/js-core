import { initialize, LDClient, LDLogger, LDOptions } from '@launchdarkly/js-client-sdk';

import { CommandParams, CommandType, ValueType } from './CommandParams';
import { CreateInstanceParams, SDKConfigParams } from './ConfigParams';
import { makeLogger } from './makeLogger';

export const badCommandError = new Error('unsupported command');
export const malformedCommand = new Error('command was malformed');

function makeSdkConfig(options: SDKConfigParams, tag: string) {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds / 1000 : undefined);

  const cf: LDOptions = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
    // useReport: options.clientSide.useReport,
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

  // Can contain streaming and polling, if streaming is set override the initial connection
  // mode. This can be removed when we add JS specific initialization that uses polling
  // and then streaming.
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

  cf.fetchGoals = false;

  return cf;
}

function makeDefaultInitialContext() {
  return { kind: 'user', key: 'key-not-specified' };
}

export class ClientEntity {
  constructor(
    private readonly client: LDClient,
    private readonly logger: LDLogger,
  ) {}

  close() {
    this.client.close();
    this.logger.info('Test ended');
  }

  async doCommand(params: CommandParams) {
    this.logger.info(`Received command: ${params.command}`);
    switch (params.command) {
      case CommandType.EvaluateFlag: {
        const evaluationParams = params.evaluate;
        if (!evaluationParams) {
          throw malformedCommand;
        }
        if (evaluationParams.detail) {
          switch (evaluationParams.valueType) {
            case ValueType.Bool:
              return this.client.boolVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as boolean,
              );
            case ValueType.Int: // Intentional fallthrough.
            case ValueType.Double:
              return this.client.numberVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as number,
              );
            case ValueType.String:
              return this.client.stringVariationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as string,
              );
            default:
              return this.client.variationDetail(
                evaluationParams.flagKey,
                evaluationParams.defaultValue,
              );
          }
        }
        switch (evaluationParams.valueType) {
          case ValueType.Bool:
            return {
              value: this.client.boolVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as boolean,
              ),
            };
          case ValueType.Int: // Intentional fallthrough.
          case ValueType.Double:
            return {
              value: this.client.numberVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as number,
              ),
            };
          case ValueType.String:
            return {
              value: this.client.stringVariation(
                evaluationParams.flagKey,
                evaluationParams.defaultValue as string,
              ),
            };
          default:
            return {
              value: this.client.variation(evaluationParams.flagKey, evaluationParams.defaultValue),
            };
        }
      }

      case CommandType.EvaluateAllFlags:
        return { state: this.client.allFlags() };

      case CommandType.IdentifyEvent: {
        const identifyParams = params.identifyEvent;
        if (!identifyParams) {
          throw malformedCommand;
        }
        await this.client.identify(identifyParams.user || identifyParams.context);
        return undefined;
      }

      case CommandType.CustomEvent: {
        const customEventParams = params.customEvent;
        if (!customEventParams) {
          throw malformedCommand;
        }
        this.client.track(
          customEventParams.eventKey,
          customEventParams.data,
          customEventParams.metricValue,
        );
        return undefined;
      }

      case CommandType.FlushEvents:
        this.client.flush();
        return undefined;

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
  const client = initialize(options.configuration.credential || 'unknown-env-id', sdkConfig);
  let failed = false;
  try {
    await Promise.race([
      client.identify(initialContext),
      new Promise((_resolve, reject) => {
        setTimeout(reject, timeout);
      }),
    ]);
  } catch (_) {
    // we get here if waitForInitialization() rejects or if we timed out
    failed = true;
  }
  if (failed && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, logger);
}
