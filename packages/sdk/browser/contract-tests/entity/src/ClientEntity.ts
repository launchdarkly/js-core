import {
  AutoEnvAttributes,
  init,
  LDClient,
  LDLogger,
  LDOptions,
} from '@launchdarkly/js-client-sdk';

export const badCommandError = new Error('unsupported command');

function makeLogger(tag: string): LDLogger {
  const doLog = (level: string, ...args: any[]): void => {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} [${tag}] ${level}:`, ...args);
  };
  return {
    debug(...args: any[]) {
      doLog('debug', ...args);
    },
    info(...args: any[]) {
      doLog('debug', ...args);
    },
    warn(...args: any[]) {
      doLog('debug', ...args);
    },
    error(...args: any[]) {
      // eslint-disable-next-line no-console
      console.error(`${new Date().toISOString()} [${tag}] error:`, ...args);
    },
  };
}

function makeSdkConfig(options: any, tag: string) {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds / 1000 : undefined);

  const cf: LDOptions = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
    // useReport: options.clientSide.useReport,
    // sendEventsOnlyForVariation: true,
  };

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
  // mode.
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

  async doCommand(params: any) {
    this.logger.info(`Received command: ${params.command}`);
    switch (params.command) {
      case 'evaluate': {
        const pe = params.evaluate;
        if (pe.detail) {
          return this.client.variationDetail(pe.flagKey, pe.defaultValue);
        }
        const value = this.client.variation(pe.flagKey, pe.defaultValue);
        return { value };
      }

      case 'evaluateAll':
        return { state: this.client.allFlags() };

      case 'identifyEvent':
        await this.client.identify(params.identifyEvent.user || params.identifyEvent.context, {
          waitForNetworkResults: true,
        });
        return undefined;

      case 'customEvent': {
        const pce = params.customEvent;
        this.client.track(pce.eventKey, pce.data, pce.metricValue);
        return undefined;
      }

      case 'flushEvents':
        this.client.flush();
        return undefined;

      default:
        throw badCommandError;
    }
  }
}

export async function newSdkClientEntity(options: any) {
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
  const client = init(
    options.configuration.credential || 'unknown-env-id',
    AutoEnvAttributes.Disabled, // TODO: Determine capability.
    sdkConfig,
  );
  let failed = false;
  try {
    await Promise.race([
      client.identify(initialContext, { waitForNetworkResults: true }),
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
