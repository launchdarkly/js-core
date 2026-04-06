import {
  Context,
  internal,
  LDHeaders,
  Platform,
  ServiceEndpoints,
} from '@launchdarkly/js-sdk-common';

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
  /** The configured foreground connection mode. Use {@link resolveForegroundMode} to derive. */
  foregroundMode: FDv2ConnectionMode;
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
  /**
   * Set an explicit connection mode override that bypasses all automatic
   * behavior (transition table, streaming, lifecycle). Pass undefined to
   * clear the override and return to automatic behavior.
   */
  setConnectionMode(mode?: FDv2ConnectionMode): void;
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

function mergeModeTables(
  defaults: ModeTable,
  overrides?: Partial<Record<FDv2ConnectionMode, ModeDefinition>>,
): ModeTable {
  if (!overrides) {
    return defaults;
  }
  const result: Record<string, ModeDefinition> = { ...defaults };
  (Object.keys(overrides) as FDv2ConnectionMode[]).forEach((mode) => {
    const override = overrides[mode];
    if (override) {
      const defaultFallback = defaults[mode]?.fdv1Fallback;
      const overrideFallback = override.fdv1Fallback;
      result[mode] = {
        ...override,
        fdv1Fallback:
          defaultFallback || overrideFallback
            ? { ...defaultFallback, ...overrideFallback }
            : undefined,
      };
    }
  });
  return result as ModeTable;
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
    foregroundMode: configuredForegroundMode,
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
  // When a user overrides a mode without specifying fdv1Fallback, the
  // default from the base mode table is preserved (fallback cannot be removed).
  const effectiveModeTable: ModeTable = mergeModeTables(
    modeTable,
    config.dataSystem?.connectionModes,
  );

  // --- Mutable state ---
  let selector: string | undefined;
  let currentResolvedMode: FDv2ConnectionMode = configuredForegroundMode;
  let foregroundMode: FDv2ConnectionMode = configuredForegroundMode;
  let dataSource: FDv2DataSource | undefined;
  let debounceManager: StateDebounceManager | undefined;
  let identifiedContext: Context | undefined;
  let factoryContext: SourceFactoryContext | undefined;
  let initialized = false;
  let bootstrapped = false;
  let closed = false;
  let flushCallback: (() => void) | undefined;

  // Explicit connection mode override — bypasses transition table entirely.
  let connectionModeOverride: FDv2ConnectionMode | undefined;

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

  /**
   * Resolve the current effective connection mode.
   *
   * Priority:
   * 1. connectionModeOverride (set via setConnectionMode) — bypasses everything
   * 2. Transition table (network/lifecycle state + foreground/background modes)
   */
  function resolveMode(): FDv2ConnectionMode {
    if (connectionModeOverride !== undefined) {
      return connectionModeOverride;
    }
    return resolveConnectionMode(transitionTable, buildModeState());
  }

  /**
   * Resolve the foreground mode input for the transition table based on
   * forced/automatic streaming state.
   *
   * Priority: forcedStreaming > automaticStreaming > configuredForegroundMode
   */
  function resolveStreamingForeground(): FDv2ConnectionMode {
    if (forcedStreaming === true) {
      return 'streaming';
    }
    if (forcedStreaming === false) {
      return configuredForegroundMode === 'streaming' ? 'one-shot' : configuredForegroundMode;
    }
    return automaticStreamingState ? 'streaming' : configuredForegroundMode;
  }

  /**
   * Compute the effective foreground mode from streaming state and push it
   * through the debounce manager. Used by setForcedStreaming and
   * setAutomaticStreamingState.
   */
  function pushForegroundMode(): void {
    foregroundMode = resolveStreamingForeground();
    debounceManager?.setRequestedMode(foregroundMode);
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
      const fallbackConfig = modeDef.fdv1Fallback;
      const fallbackPollIntervalMs = (fallbackConfig?.pollInterval ?? config.pollInterval) * 1000;

      const fallbackServiceEndpoints =
        fallbackConfig?.endpoints?.pollingBaseUri || fallbackConfig?.endpoints?.streamingBaseUri
          ? new ServiceEndpoints(
              fallbackConfig.endpoints.streamingBaseUri ?? ctx.serviceEndpoints.streaming,
              fallbackConfig.endpoints.pollingBaseUri ?? ctx.serviceEndpoints.polling,
              ctx.serviceEndpoints.events,
              ctx.serviceEndpoints.analyticsEventPath,
              ctx.serviceEndpoints.diagnosticEventPath,
              ctx.serviceEndpoints.includeAuthorizationHeader,
              ctx.serviceEndpoints.payloadFilterKey,
            )
          : ctx.serviceEndpoints;

      const fdv1RequestorFactory = () =>
        makeRequestor(
          ctx.plainContextString,
          fallbackServiceEndpoints,
          fdv1Endpoints.polling(),
          ctx.requests,
          ctx.encoding,
          ctx.baseHeaders,
          ctx.queryParams,
          config.withReasons,
          config.useReport,
        );

      const fdv1SyncFactory = () =>
        createFDv1PollingSynchronizer(fdv1RequestorFactory(), fallbackPollIntervalMs, logger);

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

    selector = payload.state;

    const context = identifiedContext;
    if (!context) {
      logger.warn(`${logTag} dataCallback called without an identified context.`);
      return;
    }

    const descriptors = flagEvalPayloadToItemDescriptors(payload.updates ?? []);
    // Flag updates and change events happen synchronously inside applyChanges.
    // The returned promise is only for async cache persistence — we intentionally
    // do not await it so the data source pipeline is not blocked by storage I/O.
    flagManager.applyChanges(context, descriptors, payload.type).catch((e) => {
      logger.warn(`${logTag} Failed to persist flag cache: ${e}`);
    });
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
      return configuredForegroundMode;
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

      // Re-check after the await — close() may have been called while
      // namespaceForEnvironment was pending.
      if (closed) {
        logger.debug(`${logTag} Identify aborted: closed during async setup.`);
        return;
      }

      factoryContext = {
        requestor,
        requests: platform.requests,
        encoding: platform.encoding!,
        serviceEndpoints: config.serviceEndpoints,
        baseHeaders,
        queryParams,
        plainContextString,
        logger,
        polling: {
          paths: pollingEndpoints,
          intervalSeconds: config.pollInterval,
        },
        streaming: {
          paths: streamingEndpoints,
          initialReconnectDelaySeconds: config.streamInitialReconnectDelay,
        },
        storage: platform.storage,
        crypto: platform.crypto,
        environmentNamespace,
        context,
      };

      // Ensure foreground mode reflects current streaming state before resolving.
      foregroundMode = resolveStreamingForeground();

      // Resolve the initial mode.
      const mode = resolveMode();
      logger.debug(`${logTag} Identify: initial mode resolved to '${mode}'.`);

      bootstrapped = identifyOptions?.bootstrap !== undefined;

      if (bootstrapped) {
        // Bootstrap data was already applied to the flag store by the
        // caller (BrowserClient.start → presetFlags) before identify
        // was called. Resolve immediately — flag evaluations will use
        // the bootstrap data synchronously.
        initialized = true;
        statusManager.requestStateUpdate('VALID');
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

    setConnectionMode(mode?: FDv2ConnectionMode): void {
      connectionModeOverride = mode;
      if (mode !== undefined) {
        debounceManager?.setRequestedMode(mode);
      } else {
        pushForegroundMode();
      }
    },

    getCurrentMode(): FDv2ConnectionMode {
      return currentResolvedMode;
    },

    setFlushCallback(callback: () => void): void {
      flushCallback = callback;
    },

    setForcedStreaming(streaming?: boolean): void {
      forcedStreaming = streaming;
      pushForegroundMode();
    },

    setAutomaticStreamingState(streaming: boolean): void {
      automaticStreamingState = streaming;
      pushForegroundMode();
    },
  };
}
