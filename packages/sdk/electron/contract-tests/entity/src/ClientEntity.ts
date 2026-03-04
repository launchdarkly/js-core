import { createHash } from 'crypto';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line import/no-extraneous-dependencies
import { createClient, LDClient, LDLogger, LDOptions } from '@launchdarkly/electron-client-sdk';

import { CommandParams, CommandType, ValueType } from './CommandParams';
import { CreateInstanceParams, SDKConfigParams } from './ConfigParams';
import { makeLogger } from './makeLogger';
import TestHook from './TestHook';

export const badCommandError = new Error('unsupported command');
export const malformedCommand = new Error('command was malformed');

const isSet = (x?: unknown) => x !== null && x !== undefined;
const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds / 1000 : undefined);

function makeSdkConfig(options: SDKConfigParams, tag: string) {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const cf: LDOptions = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
  };

  if (options.clientSide?.useReport) {
    cf.useReport = options.clientSide.useReport;
  }

  if (options.serviceEndpoints) {
    cf.streamUri = options.serviceEndpoints.streaming;
    cf.baseUri = options.serviceEndpoints.polling;
    cf.eventsUri = options.serviceEndpoints.events;
  }

  if (options.polling) {
    cf.initialConnectionMode = 'polling';
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
    cf.initialConnectionMode = 'streaming';
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
    cf.enableEventCompression = options.events.enableGzip;
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

  if (options.tls) {
    cf.tlsParams = {
      rejectUnauthorized: !options.tls.skipVerifyPeer,
    };
    if (options.tls.customCAFile) {
      cf.tlsParams.ca = fs.readFileSync(options.tls.customCAFile);
    }
  }

  if (options.wrapper) {
    cf.wrapperName = options.wrapper.name;
    cf.wrapperVersion = options.wrapper.version;
  }

  // if (options.proxy) {
  //   const { httpProxy } = options.proxy;

  //   const scheme = httpProxy.startsWith('https') ? 'https' : 'http';
  //   const [host, port] = httpProxy.replace(scheme + '://', '').split(':');

  //   cf.proxyOptions = {
  //     scheme,
  //     host,
  //     port: parseInt(port),
  //   }
  // }

  // NOTE: we may want need to discuss this at some point. Right now, we are
  // running this suite of tests because the way we register our IPC bridge listern
  // using the client side id. The problem with this is that we cannot be registering
  // the same listener multiple times. In order to support registering multiple clients,
  // we will need to change the way we hash the listener name.
  cf.enableIPC = false;

  // TODO: we might need this
  // cf.fetchGoals = false;

  return cf;
}

function makeDefaultInitialContext() {
  return { kind: 'user', key: 'key-not-specified' };
}

export class ClientEntity {
  constructor(
    private readonly _client: LDClient,
    private readonly _logger: LDLogger,
    private readonly _storagePath: string,
  ) {}

  async close() {
    try {
      await this._client.close();
      if (fs.existsSync(this._storagePath)) {
        fs.rmSync(this._storagePath, { recursive: true });
      }
      if (fs.existsSync(`${this._storagePath}.tmp`)) {
        fs.rmSync(`${this._storagePath}.tmp`, { recursive: true });
      }
      this._logger.info('Test ended');
    } catch (error) {
      this._logger.error(`Error closing client: ${error}`);
    }
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

export async function createEntity(options: CreateInstanceParams) {
  const logger = makeLogger(options.tag);

  // Need to keep track of this to know where electron is storing the caches.
  // We can make this a bit more robust by either mocking out the storage path
  // or allowing users to define a custom storage. That way we can isolate each
  // client's cache.
  const clientSideId = options.configuration.credential || 'unknown-env-id';
  logger.info(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);

  const namespace = createHash('sha256').update(clientSideId).digest?.('base64url');
  const storagePath = path.join(app.getPath('userData'), `ldcache-${namespace}`);

  const timeoutMs =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const sdkConfig = makeSdkConfig(options.configuration, options.tag);
  const initialContext =
    options.configuration.clientSide?.initialUser ||
    options.configuration.clientSide?.initialContext ||
    makeDefaultInitialContext();
  const client = createClient(clientSideId, initialContext, sdkConfig);

  const { status } = await client.start({ timeout: timeoutMs / 1000 });
  if ((status === 'failed' || status === 'timeout') && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  return new ClientEntity(client, logger, storagePath);
}
