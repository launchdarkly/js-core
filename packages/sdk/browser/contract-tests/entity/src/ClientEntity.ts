import { createClient, LDClient, LDLogger, LDOptions } from '@launchdarkly/js-client-sdk';

import { CommandParams, CommandType, ValueType } from './CommandParams';
import { CreateInstanceParams, SDKConfigParams } from './ConfigParams';
import { makeLogger } from './makeLogger';
import TestHook from './TestHook';

interface ListenerEntry {
  eventName: string;
  handler: (...args: any[]) => void;
}

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
    if (options.dataSystem.initializers) {
      options.dataSystem.initializers.forEach((initializer) => {
        if (initializer.polling?.baseUri) {
          cf.baseUri = initializer.polling.baseUri;
        }
      });
    }
    if (options.dataSystem.synchronizers) {
      options.dataSystem.synchronizers.forEach((synchronizer) => {
        if (synchronizer.streaming?.baseUri) {
          cf.streamUri = synchronizer.streaming.baseUri;
          cf.streaming = true;
          cf.streamInitialReconnectDelay = maybeTime(synchronizer.streaming.initialRetryDelayMs);
          if (!cf.baseUri) {
            cf.baseUri = synchronizer.streaming.baseUri;
          }
        } else if (synchronizer.polling?.baseUri) {
          cf.baseUri = synchronizer.polling.baseUri;
        }
      });
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
  private readonly _listeners = new Map<string, ListenerEntry>();

  constructor(
    private readonly _client: LDClient,
    private readonly _logger: LDLogger,
  ) {}

  close() {
    this._listeners.forEach((entry) => {
      this._client.off(entry.eventName, entry.handler);
    });
    this._listeners.clear();
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
        const p = params.registerFlagChangeListener;
        if (!p) {
          throw malformedCommand;
        }
        const eventName = p.flagKey ? `change:${p.flagKey}` : 'change';

        const handler = (...args: any[]) => {
          if (!p.flagKey && args.length >= 2) {
            const flagKeys = args[1] as string[];
            flagKeys.forEach((key) => {
              fetch(p.callbackUri, {
                method: 'POST',
                body: JSON.stringify({ listenerId: p.listenerId, flagKey: key }),
              }).catch(() => {});
            });
            return;
          }
          fetch(p.callbackUri, {
            method: 'POST',
            body: JSON.stringify({ listenerId: p.listenerId, flagKey: p.flagKey }),
          }).catch(() => {});
        };

        this._listeners.set(p.listenerId, { eventName, handler });
        this._client.on(eventName, handler);
        return undefined;
      }

      case CommandType.RegisterFlagValueChangeListener: {
        const p = params.registerFlagValueChangeListener;
        if (!p) {
          throw malformedCommand;
        }
        const eventName = `change:${p.flagKey}`;

        let oldValue = this._client.variation(p.flagKey, p.defaultValue);

        const handler = () => {
          const newValue = this._client.variation(p.flagKey, p.defaultValue);
          if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
            const previousValue = oldValue;
            oldValue = newValue;
            fetch(p.callbackUri, {
              method: 'POST',
              body: JSON.stringify({
                listenerId: p.listenerId,
                flagKey: p.flagKey,
                oldValue: previousValue,
                newValue,
              }),
            }).catch(() => {});
          }
        };

        this._listeners.set(p.listenerId, { eventName, handler });
        this._client.on(eventName, handler);
        return undefined;
      }

      case CommandType.UnregisterListener: {
        const p = params.unregisterListener;
        if (!p) {
          throw malformedCommand;
        }
        const entry = this._listeners.get(p.listenerId);
        if (entry) {
          this._client.off(entry.eventName, entry.handler);
          this._listeners.delete(p.listenerId);
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
    // we get here if waitForInitialization() rejects or if we timed out
    failed = true;
  }
  if (failed && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, logger);
}
