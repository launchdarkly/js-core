import { Redis } from 'ioredis';

import {
  CommandParams,
  CreateInstanceParams,
  ServerSDKConfigParams,
  ServerSideTestHook as TestHook,
} from '@launchdarkly/js-contract-test-utils/server';
import ld, {
  createMigration,
  DataSourceOptions,
  LDClient,
  LDConcurrentExecution,
  LDContext,
  LDExecutionOrdering,
  LDMigrationError,
  LDMigrationStage,
  LDMigrationSuccess,
  LDOptions,
  LDSerialExecution,
  LDUser,
  PollingDataSourceConfiguration,
  StreamingDataSourceConfiguration,
} from '@launchdarkly/node-server-sdk';
import { DynamoDBFeatureStore } from '@launchdarkly/node-server-sdk-dynamodb';
import { RedisFeatureStore } from '@launchdarkly/node-server-sdk-redis';

import BigSegmentTestStore from './BigSegmentTestStore.js';
import { Log, sdkLogger } from './log.js';

const badCommandError = new Error('unsupported command');
export { badCommandError };

// The shared ServerSDKConfigParams/SDKDataSystemParams types don't yet
// declare the persistent-store fields the harness sends for the
// persistent-store recovery suite. These mirror servicedef/sdk_config.go's
// DataSystem.Store/StoreMode until that shared type is updated.
interface SDKConfigPersistentStoreParams {
  type: 'redis' | 'dynamodb' | 'consul';
  prefix?: string;
  dsn: string;
}

interface SDKConfigPersistentCacheParams {
  mode: 'off' | 'ttl' | 'infinite';
  ttl?: number;
}

interface SDKConfigPersistentDataStoreParams {
  store: SDKConfigPersistentStoreParams;
  cache: SDKConfigPersistentCacheParams;
}

interface SDKConfigDataSystemWithStore {
  store?: {
    persistentDataStore?: SDKConfigPersistentDataStoreParams;
  };
  storeMode?: 0 | 1;
}

// Harness major version 2 sends the persistence config at the top level of
// the SDK config rather than inside dataSystem.
interface SDKConfigWithTopLevelStore {
  persistentDataStore?: SDKConfigPersistentDataStoreParams;
}

// A cache TTL, in seconds, used to approximate the harness's "infinite"
// cache mode. The SDK's persistent store wrapper has no dedicated infinite
// cache mode, so this is a TTL far longer than any contract test run.
const infiniteCacheTTLSeconds = 24 * 60 * 60;

// The harness creates this DynamoDB table itself before each test.
const dynamoDBTableName = 'sdk-contract-tests';

interface PersistentStoreHandle {
  store: ReturnType<typeof RedisFeatureStore> | ReturnType<typeof DynamoDBFeatureStore>;
  // Closes any connection the entity created for the store. The store does
  // not close a client that was given to it from the outside.
  close: () => void;
}

async function makePersistentStore(
  params: SDKConfigPersistentDataStoreParams,
): Promise<PersistentStoreHandle> {
  let cacheTTL: number;
  switch (params.cache.mode) {
    case 'off':
      cacheTTL = 0;
      break;
    case 'infinite':
      cacheTTL = infiniteCacheTTLSeconds;
      break;
    case 'ttl':
    default:
      cacheTTL = params.cache.ttl ?? 0;
      break;
  }

  switch (params.store.type) {
    case 'redis': {
      const dsn = new URL(params.store.dsn);
      const client = new Redis({
        host: dsn.hostname,
        port: Number(dsn.port),
        // The harness simulates outages with a TCP proxy, and buffered commands would
        // otherwise hide write failures from the SDK.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      // With the offline queue disabled, a command sent before the connection
      // is ready fails immediately. Wait for the connection so that the SDK's
      // first writes do not race it.
      await new Promise<void>((resolve) => {
        client.once('ready', () => resolve());
      });
      return {
        store: RedisFeatureStore({
          client,
          prefix: params.store.prefix,
          cacheTTL,
        }),
        close: () => {
          // quit rejects when the connection is down and leaves the client
          // retrying forever, so always follow it with a hard disconnect.
          client
            .quit()
            .catch(() => {})
            .finally(() => client.disconnect());
        },
      };
    }
    case 'dynamodb':
      return {
        store: DynamoDBFeatureStore(dynamoDBTableName, {
          // The harness sends the local DynamoDB endpoint as the DSN. The region
          // and static credentials match what the harness's own client uses.
          clientOptions: {
            endpoint: params.store.dsn,
            region: 'us-east-1',
            credentials: {
              accessKeyId: 'dummy',
              secretAccessKey: 'dummy',
              sessionToken: 'dummy',
            },
          },
          prefix: params.store.prefix,
          cacheTTL,
        }),
        close: () => {},
      };
    default:
      throw new Error(`Unsupported persistent data store type: ${params.store.type}`);
  }
}

export async function makeSdkConfig(
  options: ServerSDKConfigParams,
  tag: string,
): Promise<{ config: LDOptions; closeStore: () => void }> {
  const cf: LDOptions = {
    logger: sdkLogger(tag),
    diagnosticOptOut: true,
  };

  // A config has at most one persistent store. This closes the connection the
  // entity created for it, if any.
  let closeStore: () => void = () => {};

  const maybeTime = (seconds?: number) =>
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
    cf.pollInterval = maybeTime(options.polling.pollIntervalMs);
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
    cf.enableEventCompression = options.events.enableGzip;
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
    cf.hooks = TestHook.forClient(options.hooks.hooks);
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
    const dataSourceOptions: DataSourceOptions = {
      dataSourceOptionsType: 'custom',
      initializers: [],
      synchronizers: [],
    };

    if (options.dataSystem.initializers) {
      options.dataSystem.initializers.forEach((initializer) => {
        if (initializer.polling) {
          const initializerOptions: PollingDataSourceConfiguration = {
            type: 'polling',
            baseUri: initializer.polling.baseUri,
            pollInterval: maybeTime(initializer.polling.pollIntervalMs),
          };

          dataSourceOptions.initializers.push(initializerOptions);
        }
      });
    }

    if (options.dataSystem.synchronizers) {
      options.dataSystem.synchronizers.forEach((synchronizer) => {
        if (synchronizer.streaming) {
          const synchronizerOptions: StreamingDataSourceConfiguration = {
            type: 'streaming',
            baseUri: synchronizer.streaming.baseUri,
            streamInitialReconnectDelay: maybeTime(synchronizer.streaming.initialRetryDelayMs),
          };

          dataSourceOptions.synchronizers.push(synchronizerOptions);
        } else if (synchronizer.polling) {
          const synchronizerOptions: PollingDataSourceConfiguration = {
            type: 'polling',
            baseUri: synchronizer.polling.baseUri,
            pollInterval: maybeTime(synchronizer.polling.pollIntervalMs),
          };

          dataSourceOptions.synchronizers.push(synchronizerOptions);
        }
      });
    }

    if (options.dataSystem.payloadFilter) {
      cf.payloadFilterKey = options.dataSystem.payloadFilter;
    }

    cf.dataSystem = {
      dataSource: dataSourceOptions,
    };

    // The persistent-store fields aren't in the shared SDKDataSystemParams type yet
    // (see the local interfaces above), so they're read via this cast.
    const persistentDataStore = (options.dataSystem as SDKConfigDataSystemWithStore).store
      ?.persistentDataStore;
    if (persistentDataStore) {
      const handle = await makePersistentStore(persistentDataStore);
      cf.dataSystem.persistentStore = handle.store;
      closeStore = handle.close;
      // A store with zero initializers and zero synchronizers is the harness's
      // daemon-mode configuration: the SDK reads from the store and starts
      // no data source of its own.
      if (
        dataSourceOptions.initializers.length === 0 &&
        dataSourceOptions.synchronizers.length === 0
      ) {
        cf.dataSystem.useLdd = true;
      }
    }

    // FDv1Fallback configures the SDK's FDv1 Fallback Synchronizer -- engaged only in
    // response to a server-directed FDv1 Fallback Directive, separate from the FDv2
    // Primary/Fallback synchronizer chain configured above.
    if (options.dataSystem.fdv1Fallback) {
      cf.dataSystem.fdv1Fallback = {
        baseUri: options.dataSystem.fdv1Fallback.baseUri,
        pollInterval: maybeTime(options.dataSystem.fdv1Fallback.pollIntervalMs),
      };
    }
  } else {
    // The v2 harness sends the persistence config at the top level of the SDK
    // config. Map it to the FDv1 featureStore option.
    const persistentDataStore = (options as SDKConfigWithTopLevelStore).persistentDataStore;
    if (persistentDataStore) {
      const handle = await makePersistentStore(persistentDataStore);
      cf.featureStore = handle.store;
      closeStore = handle.close;
      // A store with no streaming and no polling source is the harness's
      // daemon-mode configuration: the SDK reads from the store and starts
      // no data source of its own.
      if (!options.streaming && !options.polling) {
        cf.useLdd = true;
      }
    }
  }

  return { config: cf, closeStore };
}

function getExecution(order: string) {
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

function makeMigrationPostOptions(payload: any): RequestInit {
  if (payload) {
    return { method: 'POST', body: payload };
  }
  return { method: 'POST' };
}

function contextOrUser(
  context: Record<string, any> | undefined,
  user: LDUser | undefined,
): LDContext | LDUser {
  const result = (context as LDContext | undefined) ?? user;
  if (!result) {
    throw new Error('Neither context nor user provided');
  }
  return result;
}

export interface SdkClientEntity {
  close: () => void;
  doCommand: (params: CommandParams) => Promise<any>;
}

interface ListenerEntry {
  eventName: string;
  handler: (...args: any[]) => void;
}

export async function newSdkClientEntity(options: CreateInstanceParams): Promise<SdkClientEntity> {
  const c: any = {};
  const log = Log(options.tag);
  const listeners = new Map<string, ListenerEntry>();

  log.info(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);
  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const { config, closeStore } = await makeSdkConfig(
    options.configuration as ServerSDKConfigParams,
    options.tag,
  );
  const client: LDClient = ld.init(options.configuration.credential || 'unknown-sdk-key', config);
  try {
    await client.waitForInitialization({ timeout });
  } catch (_) {
    // if waitForInitialization() rejects, the client failed to initialize, see next line
  }
  if (!client.initialized() && !options.configuration.initCanFail) {
    client.close();
    closeStore();
    throw new Error('client initialization failed');
  }

  c.close = () => {
    // Unregister all listeners before closing to avoid firing callbacks after shutdown.
    listeners.forEach((entry) => {
      client.off(entry.eventName, entry.handler);
    });
    listeners.clear();
    client.close();
    closeStore();
    log.info('Test ended');
  };

  c.doCommand = async (params: CommandParams) => {
    log.info(`Received command: ${params.command}`);
    switch (params.command) {
      case 'evaluate': {
        const pe = params.evaluate!;
        const context = contextOrUser(pe.context, pe.user);
        if (pe.detail) {
          switch (pe.valueType) {
            case 'bool':
              return client.boolVariationDetail(pe.flagKey, context, pe.defaultValue as boolean);
            case 'int': // Intentional fallthrough.
            case 'double':
              return client.numberVariationDetail(pe.flagKey, context, pe.defaultValue as number);
            case 'string':
              return client.stringVariationDetail(pe.flagKey, context, pe.defaultValue as string);
            default:
              return client.variationDetail(
                pe.flagKey,
                contextOrUser(pe.context, pe.user),
                pe.defaultValue,
              );
          }
        } else {
          switch (pe.valueType) {
            case 'bool':
              return {
                value: await client.boolVariation(pe.flagKey, context, pe.defaultValue as boolean),
              };
            case 'int': // Intentional fallthrough.
            case 'double':
              return {
                value: await client.numberVariation(pe.flagKey, context, pe.defaultValue as number),
              };
            case 'string':
              return {
                value: await client.stringVariation(pe.flagKey, context, pe.defaultValue as string),
              };
            default:
              return {
                value: await client.variation(pe.flagKey, context, pe.defaultValue),
              };
          }
        }
      }

      case 'evaluateAll': {
        const pea = params.evaluateAll!;
        const eao = {
          clientSideOnly: pea.clientSideOnly,
          detailsOnlyForTrackedFlags: pea.detailsOnlyForTrackedFlags,
          withReasons: pea.withReasons,
        };
        return { state: await client.allFlagsState(contextOrUser(pea.context, pea.user), eao) };
      }

      case 'identifyEvent':
        client.identify(
          (params.identifyEvent!.context as LDContext) || params.identifyEvent!.user!,
        );
        return undefined;

      case 'customEvent': {
        const pce = params.customEvent!;
        client.track(pce.eventKey, contextOrUser(pce.context, pce.user), pce.data, pce.metricValue);
        return undefined;
      }

      case 'flushEvents':
        client.flush();
        return undefined;

      case 'getBigSegmentStoreStatus':
        return client.bigSegmentStoreStatusProvider.requireStatus();

      case 'migrationVariation': {
        const migrationVariation = params.migrationVariation!;
        const res = await client.migrationVariation(
          migrationVariation.key,
          migrationVariation.context as LDContext,
          migrationVariation.defaultStage as LDMigrationStage,
        );
        return { result: res.value };
      }

      case 'migrationOperation': {
        const migrationOperation = params.migrationOperation!;
        const { readExecutionOrder } = migrationOperation;

        const migration = createMigration(client, {
          execution: getExecution(readExecutionOrder),
          latencyTracking: migrationOperation.trackLatency,
          errorTracking: migrationOperation.trackErrors,
          check: migrationOperation.trackConsistency ? (a, b) => a === b : undefined,
          readNew: async (payload) => {
            try {
              const res = await fetch(
                migrationOperation.newEndpoint,
                makeMigrationPostOptions(payload),
              );
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return LDMigrationSuccess(await res.text());
            } catch (err: any) {
              return LDMigrationError(err.message);
            }
          },
          writeNew: async (payload) => {
            try {
              const res = await fetch(
                migrationOperation.newEndpoint,
                makeMigrationPostOptions(payload),
              );
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return LDMigrationSuccess(await res.text());
            } catch (err: any) {
              return LDMigrationError(err.message);
            }
          },
          readOld: async (payload) => {
            try {
              const res = await fetch(
                migrationOperation.oldEndpoint,
                makeMigrationPostOptions(payload),
              );
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return LDMigrationSuccess(await res.text());
            } catch (err: any) {
              return LDMigrationError(err.message);
            }
          },
          writeOld: async (payload) => {
            try {
              const res = await fetch(
                migrationOperation.oldEndpoint,
                makeMigrationPostOptions(payload),
              );
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return LDMigrationSuccess(await res.text());
            } catch (err: any) {
              return LDMigrationError(err.message);
            }
          },
        });

        switch (migrationOperation.operation) {
          case 'read': {
            const res = await migration.read(
              migrationOperation.key,
              migrationOperation.context as LDContext,
              migrationOperation.defaultStage as LDMigrationStage,
              migrationOperation.payload,
            );
            if (res.success) {
              return { result: res.result };
            }
            return { result: res.error };
          }
          case 'write': {
            const res = await migration.write(
              migrationOperation.key,
              migrationOperation.context as LDContext,
              migrationOperation.defaultStage as LDMigrationStage,
              migrationOperation.payload,
            );

            if (res.authoritative.success) {
              return { result: res.authoritative.result };
            }
            return { result: res.authoritative.error };
          }
          default: {
            return undefined;
          }
        }
      }

      case 'registerFlagChangeListener': {
        const p = params.registerFlagChangeListener!;
        const eventName = 'update';

        const handler = (eventParams: { key: string }) => {
          fetch(p.callbackUri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listenerId: p.listenerId, flagKey: eventParams.key }),
          }).catch(() => {});
        };

        const existing = listeners.get(p.listenerId);
        if (existing) {
          client.off(existing.eventName, existing.handler);
        }
        listeners.set(p.listenerId, { eventName, handler });
        client.on(eventName, handler);
        return undefined;
      }

      case 'unregisterListener': {
        const p = params.unregisterListener!;
        const entry = listeners.get(p.listenerId);
        if (entry) {
          client.off(entry.eventName, entry.handler);
          listeners.delete(p.listenerId);
        }
        return undefined;
      }

      default:
        throw badCommandError;
    }
  };

  return c;
}
