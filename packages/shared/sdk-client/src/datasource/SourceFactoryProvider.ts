import {
  Context,
  Crypto,
  Encoding,
  LDHeaders,
  LDLogger,
  Requests,
  ServiceEndpoints,
  Storage,
} from '@launchdarkly/js-sdk-common';

import { EndpointConfig, InitializerEntry, SynchronizerEntry } from '../api/datasource';
import { DataSourcePaths } from './DataSourceConfig';
import { createCacheInitializerFactory } from './fdv2/CacheInitializer';
import { FDv2Requestor, makeFDv2Requestor } from './fdv2/FDv2Requestor';
import { poll as fdv2Poll } from './fdv2/PollingBase';
import { createPollingInitializer } from './fdv2/PollingInitializer';
import { createPollingSynchronizer } from './fdv2/PollingSynchronizer';
import { createSynchronizerSlot, InitializerFactory, SynchronizerSlot } from './fdv2/SourceManager';
import { createStreamingBase, PingHandler } from './fdv2/StreamingFDv2Base';
import { createStreamingInitializer } from './fdv2/StreamingInitializerFDv2';
import { createStreamingSynchronizer } from './fdv2/StreamingSynchronizerFDv2';

/**
 * Context needed to create concrete initializer/synchronizer factories
 * for a given identify call. Built once per identify and reused across
 * mode switches.
 */
export interface SourceFactoryContext {
  /** The FDv2 requestor for polling requests. */
  requestor: FDv2Requestor;
  /** Platform request abstraction. */
  requests: Requests;
  /** Platform encoding abstraction. */
  encoding: Encoding;
  /** Service endpoint configuration. */
  serviceEndpoints: ServiceEndpoints;
  /** Default HTTP headers. */
  baseHeaders: LDHeaders;
  /** Query parameters for requests (e.g., auth, secure mode hash). */
  queryParams: { key: string; value: string }[];
  /** JSON-serialized evaluation context. */
  plainContextString: string;
  /** Logger. */
  logger: LDLogger;

  /** Polling-specific configuration. */
  polling: {
    /** The polling endpoint paths. */
    paths: DataSourcePaths;
    /** Default poll interval in seconds. */
    intervalSeconds: number;
  };

  /** Streaming-specific configuration. */
  streaming: {
    /** The streaming endpoint paths. */
    paths: DataSourcePaths;
    /** Default initial reconnect delay in seconds. */
    initialReconnectDelaySeconds: number;
  };

  // Cache-related fields (needed for cache initializer).
  /** Platform storage for reading cached data. */
  storage: Storage | undefined;
  /** Platform crypto for computing storage keys. */
  crypto: Crypto;
  /** Environment namespace (hashed SDK key). */
  environmentNamespace: string;
  /** The context being identified. */
  context: Context;
}

/**
 * Converts declarative {@link InitializerEntry} and {@link SynchronizerEntry}
 * descriptors from the mode table into concrete {@link InitializerFactory}
 * and {@link SynchronizerSlot} instances that the {@link FDv2DataSource}
 * orchestrator can use.
 */
export interface SourceFactoryProvider {
  /**
   * Create an initializer factory from an initializer entry descriptor.
   * Returns `undefined` if the entry type is not supported.
   */
  createInitializerFactory(
    entry: InitializerEntry,
    ctx: SourceFactoryContext,
  ): InitializerFactory | undefined;

  /**
   * Create a synchronizer slot from a synchronizer entry descriptor.
   * Returns `undefined` if the entry type is not supported.
   */
  createSynchronizerSlot(
    entry: SynchronizerEntry,
    ctx: SourceFactoryContext,
  ): SynchronizerSlot | undefined;
}

function createPingHandler(
  requestor: FDv2Requestor,
  selectorGetter: () => string | undefined,
  logger: LDLogger,
): PingHandler {
  return {
    handlePing: () => fdv2Poll(requestor, selectorGetter(), false, logger),
  };
}

/**
 * Create a {@link ServiceEndpoints} with per-entry endpoint overrides applied.
 * Returns the original endpoints if no overrides are specified.
 */
function resolveEndpoints(ctx: SourceFactoryContext, endpoints?: EndpointConfig): ServiceEndpoints {
  if (!endpoints?.pollingBaseUri && !endpoints?.streamingBaseUri) {
    return ctx.serviceEndpoints;
  }
  return new ServiceEndpoints(
    endpoints.streamingBaseUri ?? ctx.serviceEndpoints.streaming,
    endpoints.pollingBaseUri ?? ctx.serviceEndpoints.polling,
    ctx.serviceEndpoints.events,
    ctx.serviceEndpoints.analyticsEventPath,
    ctx.serviceEndpoints.diagnosticEventPath,
    ctx.serviceEndpoints.includeAuthorizationHeader,
    ctx.serviceEndpoints.payloadFilterKey,
  );
}

/**
 * Get the FDv2 requestor for a polling entry. If the entry has custom
 * endpoints, creates a new requestor targeting those endpoints. Otherwise
 * returns the shared requestor from the context.
 */
function resolvePollingRequestor(
  ctx: SourceFactoryContext,
  endpoints?: EndpointConfig,
): FDv2Requestor {
  if (!endpoints?.pollingBaseUri) {
    return ctx.requestor;
  }
  const overriddenEndpoints = resolveEndpoints(ctx, endpoints);
  return makeFDv2Requestor(
    ctx.plainContextString,
    overriddenEndpoints,
    ctx.polling.paths,
    ctx.requests,
    ctx.encoding,
    ctx.baseHeaders,
    ctx.queryParams,
  );
}

/**
 * Build a streaming base instance using per-entry config with context defaults
 * as fallbacks. The `sg` selector getter is the canonical source of truth for
 * the current selector — both the stream and its ping handler use it.
 */
function buildStreamingBase(
  entry: { endpoints?: EndpointConfig; initialReconnectDelay?: number },
  ctx: SourceFactoryContext,
  sg: () => string | undefined,
) {
  const entryEndpoints = resolveEndpoints(ctx, entry.endpoints);
  const requestor = resolvePollingRequestor(ctx, entry.endpoints);
  const streamUriPath = ctx.streaming.paths.pathGet(ctx.encoding, ctx.plainContextString);
  return createStreamingBase({
    requests: ctx.requests,
    serviceEndpoints: entryEndpoints,
    streamUriPath,
    parameters: ctx.queryParams,
    selectorGetter: sg,
    headers: ctx.baseHeaders,
    initialRetryDelayMillis:
      (entry.initialReconnectDelay ?? ctx.streaming.initialReconnectDelaySeconds) * 1000,
    logger: ctx.logger,
    pingHandler: createPingHandler(requestor, sg, ctx.logger),
  });
}

/**
 * Creates a {@link SourceFactoryProvider} that handles `cache`, `polling`,
 * and `streaming` data source entries.
 */
export function createDefaultSourceFactoryProvider(): SourceFactoryProvider {
  return {
    createInitializerFactory(
      entry: InitializerEntry,
      ctx: SourceFactoryContext,
    ): InitializerFactory | undefined {
      switch (entry.type) {
        case 'polling': {
          const requestor = resolvePollingRequestor(ctx, entry.endpoints);
          return (sg: () => string | undefined) =>
            createPollingInitializer(requestor, ctx.logger, sg);
        }

        case 'streaming':
          return (sg: () => string | undefined) =>
            createStreamingInitializer(buildStreamingBase(entry, ctx, sg));

        case 'cache':
          return createCacheInitializerFactory({
            storage: ctx.storage,
            crypto: ctx.crypto,
            environmentNamespace: ctx.environmentNamespace,
            context: ctx.context,
            logger: ctx.logger,
          });

        default:
          return undefined;
      }
    },

    createSynchronizerSlot(
      entry: SynchronizerEntry,
      ctx: SourceFactoryContext,
    ): SynchronizerSlot | undefined {
      switch (entry.type) {
        case 'polling': {
          const intervalMs = (entry.pollInterval ?? ctx.polling.intervalSeconds) * 1000;
          const requestor = resolvePollingRequestor(ctx, entry.endpoints);
          const factory = (sg: () => string | undefined) =>
            createPollingSynchronizer(requestor, ctx.logger, sg, intervalMs);
          return createSynchronizerSlot(factory);
        }

        case 'streaming': {
          const factory = (sg: () => string | undefined) =>
            createStreamingSynchronizer(buildStreamingBase(entry, ctx, sg));
          return createSynchronizerSlot(factory);
        }

        default:
          return undefined;
      }
    },
  };
}
