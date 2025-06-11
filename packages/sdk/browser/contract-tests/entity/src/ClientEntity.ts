import {
  DataSourceOptions,
  initialize,
  LDClient,
  LDLogger,
  LDOptions,
} from '@launchdarkly/js-client-sdk';

import { CommandParams, CommandType, ValueType } from './CommandParams';
import { CreateInstanceParams, SDKConfigParams } from './ConfigParams';
import { makeLogger } from './makeLogger';
import TestHook from './TestHook';

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

  if (options.dataSystem) {
    const dataSourceStreamingOptions =
      options.dataSystem.synchronizers?.primary?.streaming ??
      options.dataSystem.synchronizers?.secondary?.streaming;
    const dataSourcePollingOptions =
      options.dataSystem.synchronizers?.primary?.polling ??
      options.dataSystem.synchronizers?.secondary?.polling;

    if (dataSourceStreamingOptions) {
      cf.streaming = true;
      cf.streamUri = dataSourceStreamingOptions.baseUri;
      cf.streamInitialReconnectDelay = maybeTime(dataSourceStreamingOptions.initialRetryDelayMs);
    }
    if (dataSourcePollingOptions) {
      cf.baseUri = dataSourcePollingOptions.baseUri;
      cf.pollInterval = maybeTime(dataSourcePollingOptions.pollIntervalMs);
    }

    let dataSourceOptions: DataSourceOptions | undefined;
    if (dataSourceStreamingOptions && dataSourcePollingOptions) {
      dataSourceOptions = {
        dataSourceOptionsType: 'standard',
        ...(dataSourceStreamingOptions.initialRetryDelayMs != null && {
          streamInitialReconnectDelay: maybeTime(dataSourceStreamingOptions.initialRetryDelayMs),
        }),
        ...(dataSourcePollingOptions.pollIntervalMs != null && {
          pollInterval: dataSourcePollingOptions.pollIntervalMs,
        }),
      };
    } else if (dataSourceStreamingOptions) {
      dataSourceOptions = {
        dataSourceOptionsType: 'streamingOnly',
        ...(dataSourceStreamingOptions.initialRetryDelayMs != null && {
          streamInitialReconnectDelay: maybeTime(dataSourceStreamingOptions.initialRetryDelayMs),
        }),
      };
    } else if (dataSourcePollingOptions) {
      dataSourceOptions = {
        dataSourceOptionsType: 'pollingOnly',
        ...(dataSourcePollingOptions.pollIntervalMs != null && {
          pollInterval: dataSourcePollingOptions.pollIntervalMs,
        }),
      };
    } else {
      // No data source options were specified
      dataSourceOptions = undefined;
    }

    if (options.dataSystem.payloadFilter) {
      cf.payloadFilterKey = options.dataSystem.payloadFilter;
    }

    cf.dataSystem = {
      dataSource: dataSourceOptions,
    };
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

function makeDefaultInitialContext() {
  return { kind: 'user', key: 'key-not-specified' };
}

export class ClientEntity {
  constructor(
    private readonly _client: LDClient,
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
