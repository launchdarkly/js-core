import got from 'got';
import ld, {
  createMigration,
  LDConcurrentExecution,
  LDExecutionOrdering,
  LDMigrationError,
  LDMigrationSuccess,
  LDSerialExecution,
} from 'node-server-sdk';

import BigSegmentTestStore from './BigSegmentTestStore.js';
import { Log, sdkLogger } from './log.js';
import TestHook from './TestHook.js';

const badCommandError = new Error('unsupported command');
export { badCommandError };

export function makeSdkConfig(options, tag) {
  const cf = {
    logger: sdkLogger(tag),
    diagnosticOptOut: true,
  };

  const maybeTime = (seconds) =>
    seconds === undefined || seconds === null ? undefined : seconds / 1000;

  if (options.streaming) {
    cf.streamUri = options.streaming.baseUri;
    cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
    if (options.streaming.filter) {
      cf.payloadFilterKey = options.streaming.filter;
    }
  }
  if (options.polling) {
    cf.stream = false;
    cf.baseUri = options.polling.baseUri;
    cf.pollInterval = options.polling.pollIntervalMs / 1000;
    if (options.polling.filter) {
      cf.payloadFilterKey = options.polling.filter;
    }
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
  if (options.hooks) {
    cf.hooks = options.hooks.hooks.map(
      (hook) => new TestHook(hook.name, hook.callbackUri, hook.data, hook.errors),
    );
  }
  if (options.wrapper) {
    if (options.wrapper.name) {
      cf.wrapperName = options.wrapper.name;
    }
    if (options.wrapper.version) {
      cf.wrapperVersion = options.wrapper.version;
    }
  }
  if (options.dataSystem) {
    const dataSourceStreamingOptions = options.dataSystem.synchronizers?.primary?.streaming ?? options.dataSystem.synchronizers?.secondary?.streaming;
    const dataSourcePollingOptions = options.dataSystem.synchronizers?.primary?.polling ?? options.dataSystem.synchronizers?.secondary?.polling;
    
    if (dataSourceStreamingOptions) {
      cf.streamUri = dataSourceStreamingOptions.baseUri;
      cf.streamInitialReconnectDelay = maybeTime(dataSourceStreamingOptions.initialRetryDelayMs);
      if (dataSourceStreamingOptions.filter) {
        cf.payloadFilterKey = dataSourceStreamingOptions.filter;
      }
    }
    if (dataSourcePollingOptions) {
      cf.stream = false;
      cf.baseUri = dataSourcePollingOptions.baseUri;
      cf.pollInterval = dataSourcePollingOptions.pollIntervalMs / 1000;
      if (dataSourcePollingOptions.filter) {
        cf.payloadFilterKey = dataSourcePollingOptions.filter;
      }
    }

    let dataSourceOptions;
    if (dataSourceStreamingOptions && dataSourcePollingOptions) {
      dataSourceOptions = {
        type: 'standard',
        ...(dataSourceStreamingOptions.initialRetryDelayMs != null && 
          { streamInitialReconnectDelay: maybeTime(dataSourceStreamingOptions.initialRetryDelayMs) }),
       ...(dataSourcePollingOptions.pollIntervalMs != null && 
          { pollInterval: dataSourcePollingOptions.pollIntervalMs }),
      }
    } else if (dataSourceStreamingOptions) {
      dataSourceOptions = {
        type: 'streamingOnly',
        ...(dataSourceStreamingOptions.initialRetryDelayMs != null && 
          { streamInitialReconnectDelay: maybeTime(dataSourceStreamingOptions.initialRetryDelayMs) }),
      }
    } else if (dataSourcePollingOptions) {
      dataSourceOptions = {
        type: 'pollingOnly',
        ...(dataSourcePollingOptions.pollIntervalMs != null && 
          { pollInterval: dataSourcePollingOptions.pollIntervalMs }),
      }
    } else {
      // No data source options were specified
      dataSourceOptions = undefined;
    }

    if (options.dataSystem.payloadFilter) {
      cf.payloadFilterKey = options.dataSystem.payloadFilter;
    }

    cf.dataSystem = {
      dataSource: dataSourceOptions,
    }
  }

  return cf;
}

function getExecution(order) {
  switch (order) {
    case 'serial': {
      return new LDSerialExecution(LDExecutionOrdering.Fixed);
    }
    case 'random': {
      return new LDSerialExecution(LDExecutionOrdering.Random);
    }
    case 'concurrent': {
      return new LDConcurrentExecution();
    }
    default: {
      throw new Error('Unsupported execution order.');
    }
  }
}

function makeMigrationPostOptions(payload) {
  if (payload) {
    return { body: payload };
  }
  return {};
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
    await client.waitForInitialization({ timeout: timeout });
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
          switch (pe.valueType) {
            case 'bool':
              return await client.boolVariationDetail(
                pe.flagKey,
                pe.context || pe.user,
                pe.defaultValue,
              );
            case 'int': // Intentional fallthrough.
            case 'double':
              return await client.numberVariationDetail(
                pe.flagKey,
                pe.context || pe.user,
                pe.defaultValue,
              );
            case 'string':
              return await client.stringVariationDetail(
                pe.flagKey,
                pe.context || pe.user,
                pe.defaultValue,
              );
            default:
              return await client.variationDetail(
                pe.flagKey,
                pe.context || pe.user,
                pe.defaultValue,
              );
          }
        } else {
          switch (pe.valueType) {
            case 'bool':
              return {
                value: await client.boolVariation(
                  pe.flagKey,
                  pe.context || pe.user,
                  pe.defaultValue,
                ),
              };
            case 'int': // Intentional fallthrough.
            case 'double':
              return {
                value: await client.numberVariation(
                  pe.flagKey,
                  pe.context || pe.user,
                  pe.defaultValue,
                ),
              };
            case 'string':
              return {
                value: await client.stringVariation(
                  pe.flagKey,
                  pe.context || pe.user,
                  pe.defaultValue,
                ),
              };
            default:
              return {
                value: await client.variation(pe.flagKey, pe.context || pe.user, pe.defaultValue),
              };
          }
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
        const res = await client.migrationVariation(
          migrationVariation.key,
          migrationVariation.context,
          migrationVariation.defaultStage,
        );
        return { result: res.value };

      case 'migrationOperation':
        const migrationOperation = params.migrationOperation;
        const readExecutionOrder = migrationOperation.readExecutionOrder;

        const migration = createMigration(client, {
          execution: getExecution(readExecutionOrder),
          latencyTracking: migrationOperation.trackLatency,
          errorTracking: migrationOperation.trackErrors,
          check: migrationOperation.trackConsistency ? (a, b) => a === b : undefined,
          readNew: async (payload) => {
            try {
              const res = await got.post(
                migrationOperation.newEndpoint,
                makeMigrationPostOptions(payload),
              );
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          writeNew: async (payload) => {
            try {
              const res = await got.post(
                migrationOperation.newEndpoint,
                makeMigrationPostOptions(payload),
              );
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          readOld: async (payload) => {
            try {
              const res = await got.post(
                migrationOperation.oldEndpoint,
                makeMigrationPostOptions(payload),
              );
              return LDMigrationSuccess(res.body);
            } catch (err) {
              return LDMigrationError(err.message);
            }
          },
          writeOld: async (payload) => {
            try {
              const res = await got.post(
                migrationOperation.oldEndpoint,
                makeMigrationPostOptions(payload),
              );
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
              migrationOperation.payload,
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
              migrationOperation.payload,
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
