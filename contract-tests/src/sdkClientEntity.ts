import got from 'got';

import ld, {
  createMigration,
  LDClient,
  LDConcurrentExecution,
  LDContext,
  LDExecutionOrdering,
  LDFlagValue,
  LDMigrationError,
  LDMigrationStage,
  LDMigrationSuccess,
  LDOptions,
  LDSerialExecution,
  LDUser,
} from '@launchdarkly/node-server-sdk';

import BigSegmentTestStore from './BigSegmentTestStore.js';
import { Log, sdkLogger } from './log.js';
import TestHook from './TestHook.js';

const badCommandError = new Error('unsupported command');
export { badCommandError };

interface SdkConfigOptions {
  streaming?: {
    baseUri: string;
    initialRetryDelayMs?: number;
    filter?: string;
  };
  polling?: {
    baseUri: string;
    pollIntervalMs: number;
    filter?: string;
  };
  events?: {
    allAttributesPrivate?: boolean;
    baseUri: string;
    capacity?: number;
    enableDiagnostics?: boolean;
    flushIntervalMs?: number;
    globalPrivateAttributes?: string[];
    enableGzip?: boolean;
  };
  tags?: {
    applicationId: string;
    applicationVersion: string;
  };
  bigSegments?: {
    callbackUri: string;
    userCacheSize?: number;
    userCacheTimeMs?: number;
    statusPollIntervalMs?: number;
    staleAfterMs?: number;
  };
  hooks?: {
    hooks: {
      name: string;
      callbackUri: string;
      data: any;
      errors: any;
    }[];
  };
  wrapper?: {
    name?: string;
    version?: string;
  };
}

interface CommandParams {
  command: string;
  evaluate?: {
    flagKey: string;
    context?: LDContext;
    user?: LDUser;
    defaultValue: LDFlagValue;
    detail?: boolean;
    valueType?: string;
  };
  evaluateAll?: {
    context?: LDContext;
    user?: LDUser;
    clientSideOnly?: boolean;
    detailsOnlyForTrackedFlags?: boolean;
    withReasons?: boolean;
  };
  identifyEvent?: {
    context?: LDContext;
    user?: LDUser;
  };
  customEvent?: {
    eventKey: string;
    context?: LDContext;
    user?: LDUser;
    data?: any;
    metricValue?: number;
  };
  migrationVariation?: {
    key: string;
    context: LDContext;
    defaultStage: LDMigrationStage;
  };
  migrationOperation?: {
    operation: string;
    key: string;
    context: LDContext;
    defaultStage: LDMigrationStage;
    payload: any;
    readExecutionOrder: string;
    trackLatency?: boolean;
    trackErrors?: boolean;
    trackConsistency?: boolean;
    newEndpoint: string;
    oldEndpoint: string;
  };
}

export function makeSdkConfig(options: SdkConfigOptions, tag: string): LDOptions {
  const cf: LDOptions = {
    logger: sdkLogger(tag),
    diagnosticOptOut: true,
  };

  const maybeTime = (seconds?: number) =>
    seconds === undefined || seconds === null ? undefined : seconds / 1000;

  if (options.streaming) {
    cf.streamUri = options.streaming.baseUri;
    cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
    if (options.streaming.filter) {
      cf.application = cf.application || {};
      cf.application.payloadFilterKey = options.streaming.filter;
    }
  }

  if (options.polling) {
    cf.stream = false;
    cf.baseUri = options.polling.baseUri;
    cf.pollInterval = options.polling.pollIntervalMs / 1000;
    if (options.polling.filter) {
      cf.application = cf.application || {};
      cf.application.payloadFilterKey = options.polling.filter;
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

  return cf;
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

function makeMigrationPostOptions(payload: any) {
  if (payload) {
    return { body: payload };
  }
  return {};
}

function contextOrUser(
  context: LDContext | undefined,
  user: LDUser | undefined,
): LDContext | LDUser {
  return (context || user)!;
}

export interface SdkClientEntity {
  close: () => void;
  doCommand: (params: CommandParams) => Promise<any>;
}

export async function newSdkClientEntity(options: any): Promise<SdkClientEntity> {
  const c: any = {};
  const log = Log(options.tag);

  log.info(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);
  const timeout =
    options.configuration.startWaitTimeMs !== null &&
    options.configuration.startWaitTimeMs !== undefined
      ? options.configuration.startWaitTimeMs
      : 5000;
  const client: LDClient = ld.init(
    options.configuration.credential || 'unknown-sdk-key',
    makeSdkConfig(options.configuration, options.tag),
  );
  try {
    await client.waitForInitialization({ timeout });
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

  c.doCommand = async (params: CommandParams) => {
    log.info(`Received command: ${params.command}`);
    switch (params.command) {
      case 'evaluate': {
        const pe = params.evaluate!;
        const context = contextOrUser(pe.context, pe.user);
        if (pe.detail) {
          switch (pe.valueType) {
            case 'bool':
              return client.boolVariationDetail(pe.flagKey, context, pe.defaultValue);
            case 'int': // Intentional fallthrough.
            case 'double':
              return client.numberVariationDetail(pe.flagKey, context, pe.defaultValue);
            case 'string':
              return client.stringVariationDetail(pe.flagKey, context, pe.defaultValue);
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
                value: await client.boolVariation(pe.flagKey, context, pe.defaultValue),
              };
            case 'int': // Intentional fallthrough.
            case 'double':
              return {
                value: await client.numberVariation(pe.flagKey, context, pe.defaultValue),
              };
            case 'string':
              return {
                value: await client.stringVariation(pe.flagKey, context, pe.defaultValue),
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
        client.identify(params.identifyEvent!.context || params.identifyEvent!.user!);
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
          migrationVariation.context,
          migrationVariation.defaultStage,
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
              const res = await got.post(
                migrationOperation.newEndpoint,
                makeMigrationPostOptions(payload),
              );
              return LDMigrationSuccess(res.body);
            } catch (err: any) {
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
            } catch (err: any) {
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
            } catch (err: any) {
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
            } catch (err: any) {
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
            }
            return { result: res.error };
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
            }
            return { result: res.authoritative.error };
          }
          default: {
            return undefined;
          }
        }
      }

      default:
        throw badCommandError;
    }
  };

  return c;
}
