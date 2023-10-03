import ld from 'node-server-sdk';

import BigSegmentTestStore from './BigSegmentTestStore.js';
import { Log, sdkLogger } from './log.js';

const badCommandError = new Error('unsupported command');
export { badCommandError };

export function makeSdkConfig(options, tag) {
  const cf = {
    logger: sdkLogger(tag),
    diagnosticOptOut: true
  };
  const maybeTime = (seconds) =>
    seconds === undefined || seconds === null ? undefined : seconds / 1000;
  if (options.streaming) {
    cf.streamUri = options.streaming.baseUri;
    cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
  }
  if (options.polling) {
    cf.stream = false;
    cf.baseUri = options.polling.baseUri;
    cf.pollInterface = options.polling.pollIntervalMs / 1000;
  }
  if (options.events) {
    cf.allAttributesPrivate = options.events.allAttributesPrivate;
    cf.eventsUri = options.events.baseUri;
    cf.capacity = options.events.capacity;
    cf.diagnosticOptOut = !options.events.enableDiagnostics;
    cf.flushInterval = maybeTime(options.events.flushIntervalMs);
    cf.privateAttributes = options.events.globalPrivateAttributes;
  }
  if (options.tags) {
    cf.application = {
      id: options.tags.applicationId,
      version: options.tags.applicationVersion,
    };
  }
  if (options.bigSegments) {
    const bigSegmentsOptions = options.bigSegments;
    cf.bigSegments = {
      store: () => new BigSegmentTestStore(bigSegmentsOptions.callbackUri),
      userCacheSize: bigSegmentsOptions.userCacheSize,
      userCacheTime: bigSegmentsOptions.userCacheTimeMs
        ? bigSegmentsOptions.userCacheTimeMs / 1000
        : undefined,
      statusPollInterval: bigSegmentsOptions.statusPollIntervalMs
        ? bigSegmentsOptions.statusPollIntervalMs / 1000
        : undefined,
      staleAfter: bigSegmentsOptions.staleAfterMs
        ? bigSegmentsOptions.staleAfterMs / 1000
        : undefined,
    };
  }
  return cf;
}

export async function newSdkClientEntity(options) {
  const c = {};
  const log = Log(options.tag);

  log.info('Creating client with configuration: ' + JSON.stringify(options.configuration));
  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const client = ld.init(
    options.configuration.credential || 'unknown-sdk-key',
    makeSdkConfig(options.configuration, options.tag),
  );
  try {
    await Promise.race([
      client.waitForInitialization(),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  } catch (_) {
    // if waitForInitialization() rejects, the client failed to initialize, see next line
  }
  if (!client.initialized() && !options.configuration.initCanFail) {
    client.close();
    throw new Error('client initialization failed');
  }

  c.close = () => {
    client.close();
    log.info('Test ended');
  };

  c.doCommand = async (params) => {
    log.info('Received command: ' + params.command);
    switch (params.command) {
      case 'evaluate': {
        const pe = params.evaluate;
        if (pe.detail) {
          return await client.variationDetail(pe.flagKey, pe.context || pe.user, pe.defaultValue);
        } else {
          const value = await client.variation(pe.flagKey, pe.context || pe.user, pe.defaultValue);
          return { value };
        }
      }

      case 'evaluateAll': {
        const pea = params.evaluateAll;
        const eao = {
          clientSideOnly: pea.clientSideOnly,
          detailsOnlyForTrackedFlags: pea.detailsOnlyForTrackedFlags,
          withReasons: pea.withReasons,
        };
        return { state: await client.allFlagsState(pea.context || pea.user, eao) };
      }

      case 'identifyEvent':
        client.identify(params.identifyEvent.context || params.identifyEvent.user);
        return undefined;

      case 'customEvent': {
        const pce = params.customEvent;
        client.track(pce.eventKey, pce.context || pce.user, pce.data, pce.metricValue);
        return undefined;
      }

      case 'flushEvents':
        client.flush();
        return undefined;

      case 'getBigSegmentStoreStatus':
        return await client.bigSegmentStoreStatusProvider.requireStatus();

      default:
        throw badCommandError;
    }
  };

  return c;
}
