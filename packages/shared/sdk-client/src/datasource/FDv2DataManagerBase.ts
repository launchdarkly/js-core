import { Context, internal, LDHeaders, Platform } from '@launchdarkly/js-sdk-common';

import {
  FDv2ConnectionMode,
  ModeDefinition,
  ModeResolutionTable,
  ModeState,
} from '../api/datasource';
import { LDIdentifyOptions } from '../api/LDIdentifyOptions';
import { Configuration } from '../configuration/Configuration';
import { DataManager } from '../DataManager';
import { FlagManager } from '../flag-manager/FlagManager';
import LDEmitter from '../LDEmitter';
import { namespaceForEnvironment } from '../storage/namespaceUtils';
import { ModeTable } from './ConnectionModeConfig';
import { createDataSourceStatusManager, DataSourceStatusManager } from './DataSourceStatusManager';
import { DataSourceEndpoints, fdv2Endpoints } from './Endpoints';
import { createFDv1PollingSynchronizer } from './fdv2/FDv1PollingSynchronizer';
import { createFDv2DataSource, FDv2DataSource } from './fdv2/FDv2DataSource';
import { makeFDv2Requestor } from './fdv2/FDv2Requestor';
import { createSynchronizerSlot, InitializerFactory, SynchronizerSlot } from './fdv2/SourceManager';
import { flagEvalPayloadToItemDescriptors } from './flagEvalMapper';
import { resolveConnectionMode } from './ModeResolver';
import { makeRequestor } from './Requestor';
import { SourceFactoryContext, SourceFactoryProvider } from './SourceFactoryProvider';
import {
  createStateDebounceManager,
  LifecycleState,
  NetworkState,
  PendingState,
  StateDebounceManager,
} from './StateDebounceManager';

const logTag = '[FDv2DataManagerBase]';

/**
 * Configuration for creating an {@link FDv2DataManagerControl}.
 */
export interface FDv2DataManagerBaseConfig {
  platform: Platform;
  flagManager: FlagManager;
  credential: string;
  config: Configuration;
  baseHeaders: LDHeaders;
  emitter: LDEmitter;

  /** Mode resolution table for this platform. */
  transitionTable: ModeResolutionTable;
  /** The initial foreground connection mode. */
  initialForegroundMode: FDv2ConnectionMode;
  /** The background connection mode, if any. */
  backgroundMode: FDv2ConnectionMode | undefined;
  /** The mode table mapping modes to data source definitions. */
  modeTable: ModeTable;
  /** Provider that converts DataSourceEntry descriptors to concrete factories. */
  sourceFactoryProvider: SourceFactoryProvider;
  /**
   * Platform-specific function to build query params for each identify call.
   * Browser returns `[{ key: 'auth', value: credential }]` + optional hash.
   * Mobile returns `[]` (uses Authorization header instead).
   */
  buildQueryParams: (identifyOptions?: LDIdentifyOptions) => { key: string; value: string }[];

  /**
   * FDv1 endpoint factory for fallback. When provided, a blocked FDv1
   * polling synchronizer slot is automatically appended to every data
   * source. It is activated when an FDv2 response includes the
   * `x-ld-fd-fallback` header.
   *
   * Browser: `browserFdv1Endpoints(clientSideId)`
   * Mobile: `mobileFdv1Endpoints()`
   */
  fdv1Endpoints?: DataSourceEndpoints;

  /** Fallback condition timeout in ms (default 120s). */
  fallbackTimeoutMs?: number;
  /** Recovery condition timeout in ms (default 300s). */
  recoveryTimeoutMs?: number;
}

/**
 * The public interface returned by {@link createFDv2DataManagerBase}.
 * Extends {@link DataManager} with mode control methods.
 */
export interface FDv2DataManagerControl extends DataManager {
  /** Update the pending network state. Goes through debounce. */
  setNetworkState(state: NetworkState): void;
  /** Update the pending lifecycle state. Goes through debounce. */
  setLifecycleState(state: LifecycleState): void;
  /** Update the requested connection mode. Goes through debounce. */
  setRequestedMode(mode: FDv2ConnectionMode): void;
  /**
   * Set the effective foreground mode directly. Used by browser
   * listener-driven streaming to promote/demote the foreground mode.
   * Goes through debounce.
   */
  setForegroundMode(mode: FDv2ConnectionMode): void;
  /** Get the currently resolved connection mode. */
  getCurrentMode(): FDv2ConnectionMode;
  /** The configured default foreground mode (from config, not auto-promoted). */
  readonly configuredForegroundMode: FDv2ConnectionMode;
  /**
   * Set a callback to flush pending analytics events. Called immediately
   * (not debounced) when the lifecycle transitions to background.
   */
  setFlushCallback(callback: () => void): void;
}

/**
 * Creates a shared FDv2 data manager that owns mode resolution, debouncing,
 * selector state, and FDv2DataSource lifecycle. Platform SDKs (browser, RN)
 * wrap this with platform-specific config and event wiring.
 */
export function createFDv2DataManagerBase(
  baseConfig: FDv2DataManagerBaseConfig,
): FDv2DataManagerControl {
  const {
    platform,
    flagManager,
    config,
    baseHeaders,
    emitter,
    transitionTable,
    initialForegroundMode,
    backgroundMode,
    modeTable,
    sourceFactoryProvider,
    buildQueryParams,
    fdv1Endpoints,
    fallbackTimeoutMs,
    recoveryTimeoutMs,
  } = baseConfig;

  const { logger } = config;
  const statusManager: DataSourceStatusManager = createDataSourceStatusManager(emitter);
  const endpoints = fdv2Endpoints();

  // Merge user-provided connection mode overrides into the mode table.
  const effectiveModeTable: ModeTable = config.dataSystem?.connectionModes
    ? { ...modeTable, ...config.dataSystem.connectionModes }
    : modeTable;

  // --- Mutable state ---
  let selector: string | undefined;
  let currentResolvedMode: FDv2ConnectionMode = initialForegroundMode;
  let foregroundMode: FDv2ConnectionMode = initialForegroundMode;
  let dataSource: FDv2DataSource | undefined;
  let debounceManager: StateDebounceManager | undefined;
  let identifiedContext: Context | undefined;
  let factoryContext: SourceFactoryContext | undefined;
  let initialized = false;
  let bootstrapped = false;
  let closed = false;
  let flushCallback: (() => void) | undefined;

  // Forced/automatic streaming state for browser listener-driven streaming.
  let forcedStreaming: boolean | undefined;
  let automaticStreamingState = false;

  // Outstanding identify promise callbacks — needed so that mode switches
  // during identify can wire the new data source's completion to the
  // original identify promise.
  let pendingIdentifyResolve: (() => void) | undefined;
  let pendingIdentifyReject: ((err: Error) => void) | undefined;

  // Current debounce input state.
  let networkState: NetworkState = 'available';
  let lifecycleState: LifecycleState = 'foreground';

  // --- Helpers ---

  function getModeDefinition(mode: FDv2ConnectionMode): ModeDefinition {
    return effectiveModeTable[mode];
  }

  function buildModeState(): ModeState {
    return {
      lifecycle: lifecycleState,
      networkAvailable: networkState === 'available',
      foregroundMode,
      backgroundMode: backgroundMode ?? 'offline',
    };
  }

  function resolveMode(): FDv2ConnectionMode {
    return resolveConnectionMode(transitionTable, buildModeState());
  }

  /**
   * Determine the foreground mode based on forced/automatic streaming state.
   *
   * +-----------+-----------+---------------------------+
   * |  forced   | automatic |     result                |
   * +-----------+-----------+---------------------------+
   * | true      | any       | 'streaming'               |
   * | false     | any       | configured, never streaming|
   * | undefined | true      | 'streaming'               |
   * | undefined | false     | configured mode           |
   * +-----------+-----------+---------------------------+
   */
  function resolveStreamingMode(): FDv2ConnectionMode {
    if (forcedStreaming === true) {
      return 'streaming';
    }
    if (forcedStreaming === false) {
      // Explicitly forced off — use configured mode, but never streaming.
      return initialForegroundMode === 'streaming' ? 'one-shot' : initialForegroundMode;
    }
    // forcedStreaming === undefined — automatic behavior.
    return automaticStreamingState ? 'streaming' : initialForegroundMode;
  }

  /**
   * Convert a ModeDefinition's entries into concrete InitializerFactory[]
   * and SynchronizerSlot[] using the source factory provider.
   */
  function buildFactories(
    modeDef: ModeDefinition,
    ctx: SourceFactoryContext,
    includeInitializers: boolean,
  ): {
    initializerFactories: InitializerFactory[];
    synchronizerSlots: SynchronizerSlot[];
  } {
    const initializerFactories: InitializerFactory[] = [];
    if (includeInitializers) {
      modeDef.initializers
        // Skip cache when bootstrapped — bootstrap data was applied to the
        // flag store before identify, so the cache would only load older data.
        .filter((entry) => !(bootstrapped && entry.type === 'cache'))
        .forEach((entry) => {
          const factory = sourceFactoryProvider.createInitializerFactory(entry, ctx);
          if (factory) {
            initializerFactories.push(factory);
          } else {
            logger.warn(
              `${logTag} Unsupported initializer type '${entry.type}'. It will be skipped.`,
            );
          }
        });
    }

    const synchronizerSlots: SynchronizerSlot[] = [];
    modeDef.synchronizers.forEach((entry) => {
      const slot = sourceFactoryProvider.createSynchronizerSlot(entry, ctx);
      if (slot) {
        synchronizerSlots.push(slot);
      } else {
        logger.warn(`${logTag} Unsupported synchronizer type '${entry.type}'. It will be skipped.`);
      }
    });

    // Append a blocked FDv1 fallback synchronizer when configured and
    // when there are FDv2 synchronizers to fall back from.
    if (fdv1Endpoints && synchronizerSlots.length > 0) {
      const fdv1RequestorFactory = () =>
        makeRequestor(
          ctx.plainContextString,
          ctx.serviceEndpoints,
          fdv1Endpoints.polling(),
          ctx.requests,
          ctx.encoding,
          ctx.baseHeaders,
          ctx.queryParams,
          config.withReasons,
          config.useReport,
        );

      const fdv1SyncFactory = () =>
        createFDv1PollingSynchronizer(fdv1RequestorFactory(), config.pollInterval * 1000, logger);

      synchronizerSlots.push(createSynchronizerSlot(fdv1SyncFactory, { isFDv1Fallback: true }));
    }

    return { initializerFactories, synchronizerSlots };
  }

  /**
   * The data callback shared across all FDv2DataSource instances for
   * the current identify. Handles selector tracking and flag updates.
   */
  function dataCallback(payload: internal.Payload): void {
    logger.debug(
      `${logTag} dataCallback: type=${payload.type}, updates=${payload.updates.length}, state=${payload.state}`,
    );

    if (payload.state) {
      selector = payload.state;
    }

    if (payload.type === 'none') {
      return;
    }

    const context = identifiedContext;
    if (!context) {
      logger.warn(`${logTag} dataCallback called without an identified context.`);
      return;
    }

    const descriptors = flagEvalPayloadToItemDescriptors(payload.updates);

    if (payload.type === 'full') {
      flagManager.init(context, descriptors);
    } else {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        flagManager.upsert(context, key, descriptor);
      });
    }
  }

  /**
   * Create and start a new FDv2DataSource for the given mode.
   *
   * @param mode The connection mode to use.
   * @param includeInitializers Whether to include initializers (true on
   *   first identify, false on mode switch after initialization).
   */
  function createAndStartDataSource(mode: FDv2ConnectionMode, includeInitializers: boolean): void {
    if (!factoryContext) {
      logger.warn(`${logTag} Cannot create data source without factory context.`);
      return;
    }

    const modeDef = getModeDefinition(mode);
    const { initializerFactories, synchronizerSlots } = buildFactories(
      modeDef,
      factoryContext,
      includeInitializers,
    );

    currentResolvedMode = mode;

    // If there are no sources at all (e.g., offline or one-shot mode
    // post-initialization), don't create a data source.
    if (initializerFactories.length === 0 && synchronizerSlots.length === 0) {
      logger.debug(`${logTag} Mode '${mode}' has no sources. No data source created.`);
      if (!initialized && pendingIdentifyResolve) {
        // Offline mode during initial identify — resolve immediately.
        // The SDK will use cached data if any.
        initialized = true;
        pendingIdentifyResolve();
        pendingIdentifyResolve = undefined;
        pendingIdentifyReject = undefined;
      }
      return;
    }

    const selectorGetter = () => selector;

    dataSource = createFDv2DataSource({
      initializerFactories,
      synchronizerSlots,
      dataCallback,
      statusManager,
      selectorGetter,
      logger,
      fallbackTimeoutMs,
      recoveryTimeoutMs,
    });

    dataSource
      .start()
      .then(() => {
        initialized = true;
        if (pendingIdentifyResolve) {
          pendingIdentifyResolve();
          pendingIdentifyResolve = undefined;
          pendingIdentifyReject = undefined;
        }
      })
      .catch((err) => {
        if (pendingIdentifyReject) {
          pendingIdentifyReject(err instanceof Error ? err : new Error(String(err)));
          pendingIdentifyResolve = undefined;
          pendingIdentifyReject = undefined;
        }
      });
  }

  /**
   * Reconciliation callback invoked when the debounce timer fires.
   * Resolves the new mode and switches data sources if needed.
   */
  function onReconcile(pendingState: PendingState): void {
    if (closed || !factoryContext) {
      return;
    }

    // Update local state from the debounced pending state.
    networkState = pendingState.networkState;
    lifecycleState = pendingState.lifecycleState;
    foregroundMode = pendingState.requestedMode;

    const newMode = resolveMode();

    if (newMode === currentResolvedMode) {
      logger.debug(`${logTag} Reconcile: mode unchanged (${newMode}). No action.`);
      return;
    }

    logger.debug(
      `${logTag} Reconcile: mode switching from '${currentResolvedMode}' to '${newMode}'.`,
    );

    // Close the current data source.
    dataSource?.close();
    dataSource = undefined;

    // Include initializers if we don't have a selector yet. This covers:
    // - Not yet initialized (normal case)
    // - Initialized from bootstrap (no selector) — need initializers to
    //   get a full payload via poll before starting synchronizers
    // When we have a selector, only synchronizers change (spec 5.3.8).
    const includeInitializers = !selector;

    createAndStartDataSource(newMode, includeInitializers);
  }

  // --- Public interface ---

  return {
    get configuredForegroundMode(): FDv2ConnectionMode {
      return initialForegroundMode;
    },

    async identify(
      identifyResolve: () => void,
      identifyReject: (err: Error) => void,
      context: Context,
      identifyOptions?: LDIdentifyOptions,
    ): Promise<void> {
      if (closed) {
        logger.debug(`${logTag} Identify called after close.`);
        return;
      }

      // Tear down previous state.
      dataSource?.close();
      dataSource = undefined;
      debounceManager?.close();
      debounceManager = undefined;
      selector = undefined;
      initialized = false;
      bootstrapped = false;
      identifiedContext = context;
      pendingIdentifyResolve = identifyResolve;
      pendingIdentifyReject = identifyReject;

      const plainContextString = JSON.stringify(Context.toLDContext(context));
      const queryParams = buildQueryParams(identifyOptions);
      if (config.withReasons) {
        queryParams.push({ key: 'withReasons', value: 'true' });
      }
      const streamingEndpoints = endpoints.streaming();
      const pollingEndpoints = endpoints.polling();

      const requestor = makeFDv2Requestor(
        plainContextString,
        config.serviceEndpoints,
        pollingEndpoints,
        platform.requests,
        platform.encoding!,
        baseHeaders,
        queryParams,
      );

      const environmentNamespace = await namespaceForEnvironment(
        platform.crypto,
        baseConfig.credential,
      );

      factoryContext = {
        requestor,
        requests: platform.requests,
        encoding: platform.encoding!,
        serviceEndpoints: config.serviceEndpoints,
        pollingPaths: pollingEndpoints,
        streamingPaths: streamingEndpoints,
        baseHeaders,
        queryParams,
        plainContextString,
        selectorGetter: () => selector,
        streamInitialReconnectDelay: config.streamInitialReconnectDelay,
        pollInterval: config.pollInterval,
        logger,
        storage: platform.storage,
        crypto: platform.crypto,
        environmentNamespace,
        context,
      };

      // Resolve the initial mode.
      const mode = resolveMode();
      logger.debug(`${logTag} Identify: initial mode resolved to '${mode}'.`);

      bootstrapped = !!(identifyOptions as any)?.bootstrap;

      if (bootstrapped) {
        // Bootstrap data was already applied to the flag store by the
        // caller (BrowserClient.start → presetFlags) before identify
        // was called. Resolve immediately — flag evaluations will use
        // the bootstrap data synchronously.
        initialized = true;
        // selector remains undefined — bootstrap data has no selector.
        pendingIdentifyResolve?.();
        pendingIdentifyResolve = undefined;
        pendingIdentifyReject = undefined;

        // Only create a data source if the mode has synchronizers.
        // For one-shot (no synchronizers), there's nothing more to do.
        const modeDef = getModeDefinition(mode);
        if (modeDef.synchronizers.length > 0) {
          // Start synchronizers without initializers — we already have
          // data from bootstrap. Initializers will run on mode switches
          // if selector is still undefined (see onReconcile).
          createAndStartDataSource(mode, false);
        }
      } else {
        // Normal identify — create and start the data source with full pipeline.
        createAndStartDataSource(mode, true);
      }

      // Set up debouncing for subsequent state changes.
      debounceManager = createStateDebounceManager({
        initialState: {
          networkState,
          lifecycleState,
          requestedMode: foregroundMode,
        },
        onReconcile,
      });
    },

    close(): void {
      closed = true;
      dataSource?.close();
      dataSource = undefined;
      debounceManager?.close();
      debounceManager = undefined;
      pendingIdentifyResolve = undefined;
      pendingIdentifyReject = undefined;
    },

    setNetworkState(state: NetworkState): void {
      networkState = state;
      debounceManager?.setNetworkState(state);
    },

    setLifecycleState(state: LifecycleState): void {
      // Flush immediately when going to background — the app may be
      // about to close. This is not debounced (CONNMODE spec 3.3.1).
      if (state === 'background' && lifecycleState !== 'background') {
        flushCallback?.();
      }
      lifecycleState = state;
      debounceManager?.setLifecycleState(state);
    },

    setRequestedMode(mode: FDv2ConnectionMode): void {
      foregroundMode = mode;
      debounceManager?.setRequestedMode(mode);
    },

    setForegroundMode(mode: FDv2ConnectionMode): void {
      foregroundMode = mode;
      debounceManager?.setRequestedMode(mode);
    },

    getCurrentMode(): FDv2ConnectionMode {
      return currentResolvedMode;
    },

    setFlushCallback(callback: () => void): void {
      flushCallback = callback;
    },

    setForcedStreaming(streaming?: boolean): void {
      forcedStreaming = streaming;
      this.setForegroundMode(resolveStreamingMode());
    },

    setAutomaticStreamingState(streaming: boolean): void {
      automaticStreamingState = streaming;
      this.setForegroundMode(resolveStreamingMode());
    },
  };
}
