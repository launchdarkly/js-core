import got from 'got';
import ld, {
  LDExecution,
  LDExecutionOrdering,
  LDMigrationError,
  LDMigrationSuccess,
  LDSerialExecution,
  Migration,
} from 'node-server-sdk';

import BigSegmentTestStore from './BigSegmentTestStore.js';
import { Log, sdkLogger } from './log.js';

const badCommandError = new Error('unsupported command');
export { badCommandError };

export function makeSdkConfig(options, tag) {
  const cf = {
    logger: sdkLogger(tag),
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

      case 'migrationVariation':
        const migrationVariation = params.migrationVariation;
        const res = await client.variationMigration(
          migrationVariation.key,
          migrationVariation.context,
          migrationVariation.defaultStage,
        );
        return { result: res.value };

      case 'migrationOperation':
        const migrationOperation = params.migrationOperation;
        const migration = new Migration(client, {
          execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
          latencyTracking: migrationOperation.trackLatency,
          errorTracking: migrationOperation.trackErrors,
          check: migrationOperation.trackConsistency ? (a, b) => a === b : undefined,
          readNew: async () => {
            try {
              const res = await got.post(migrationOperation.newEndpoint, {});
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          writeNew: async () => {
            try {
              const res = await got.post(migrationOperation.newEndpoint, {});
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          readOld: async () => {
            try {
              const res = await got.post(migrationOperation.oldEndpoint, {});
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          writeOld: async () => {
            try {
              const res = await got.post(migrationOperation.oldEndpoint, {});
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
        });

        switch (migrationOperation.operation) {
          case 'read': {
            const res = await migration.read(
              migrationOperation.key,
              migrationOperation.context,
              migrationOperation.defaultStage,
            );
            if (res.success) {
              return { result: res.result };
            } else {
              return { result: res.error };
            }
          }
          case 'write': {
            const res = await migration.write(
              migrationOperation.key,
              migrationOperation.context,
              migrationOperation.defaultStage,
            );

            if (res.authoritative.success) {
              return { result: res.authoritative.result };
            } else {
              return { result: res.authoritative.error };
            }
          }
        }
        return undefined;

      default:
        throw badCommandError;
    }
  };

  return c;
}
