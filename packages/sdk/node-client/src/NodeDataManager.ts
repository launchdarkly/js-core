import {
  BaseDataManager,
  Configuration,
  ConnectionMode,
  Context,
  DataSourcePaths,
  DataSourceState,
  FlagManager,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  makeRequestor,
  Platform,
  readFlagsFromBootstrap,
} from '@launchdarkly/js-client-sdk-common';

import type { NodeIdentifyOptions } from './NodeIdentifyOptions';
import type { ValidatedOptions } from './options';

const logTag = '[NodeDataManager]';

export default class NodeDataManager extends BaseDataManager {
  protected connectionMode: ConnectionMode = 'streaming';
  private _currentHash?: string;
  private _pendingIdentifyReject?: (err: Error) => void;
  // Serializes connection-mode transitions so concurrent calls cannot leave state
  // (event-sending, processor, mode) out of sync.
  private _connectionModeQueue: Promise<void> = Promise.resolve();

  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    private readonly _nodeConfig: ValidatedOptions,
    getPollingPaths: () => DataSourcePaths,
    getStreamingPaths: () => DataSourcePaths,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    diagnosticsManager?: internal.DiagnosticsManager,
  ) {
    super(
      platform,
      flagManager,
      credential,
      config,
      getPollingPaths,
      getStreamingPaths,
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
    this.connectionMode = _nodeConfig.initialConnectionMode;
    this._currentHash = _nodeConfig.hash;
  }

  private _debugLog(message: any, ...args: any[]) {
    this.logger.debug(`${logTag} ${message}`, ...args);
  }

  // Capture-then-clear-then-invoke the pending identify reject so a re-entrant call from
  // the reject handler cannot observe a stale callback.
  private _rejectPendingIdentify(error: Error): void {
    if (this._pendingIdentifyReject) {
      const reject = this._pendingIdentifyReject;
      this._pendingIdentifyReject = undefined;
      reject(error);
    }
  }

  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    if (this.closed) {
      this._debugLog('Identify called after data manager was closed.');
      identifyReject(new Error('Client has been closed.'));
      return;
    }
    this.context = context;

    const nodeOptions = identifyOptions as NodeIdentifyOptions | undefined;
    this._currentHash = nodeOptions?.hash ?? this._nodeConfig.hash;
    if (this._currentHash) {
      this.setConnectionParams({ queryParameters: [{ key: 'h', value: this._currentHash }] });
    } else {
      this.setConnectionParams();
    }

    // Snapshot the mode before any await so the bootstrap path and the stale-snapshot
    // detection below both see a consistent starting point.
    const startedOffline = this.connectionMode === 'offline';

    // Bootstrap and cache are mutually exclusive: when bootstrap data is provided it
    // resolves identify immediately, so we must not also load (and potentially overwrite
    // with) stale cached flags.
    if (identifyOptions?.bootstrap) {
      if (identifyOptions.waitForNetworkResults) {
        this.logger.warn(
          `${logTag} 'waitForNetworkResults' is ignored when 'bootstrap' is provided.`,
        );
      }
      this._finishIdentifyFromBootstrap(context, identifyOptions, identifyResolve);
      if (!startedOffline) {
        // Open a connection for ongoing updates, but identify is already resolved so no
        // callbacks are forwarded.
        this._setupConnection(context);
      }
      return;
    }

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (this.closed) {
      this._debugLog('Identify called after data manager was closed (during cache load).');
      identifyReject(new Error('Client has been closed.'));
      return;
    }
    // Re-read connectionMode after the await: a concurrent setConnectionMode call may have
    // changed it while loadCached was in flight.
    const offline = this.connectionMode === 'offline';
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !startedOffline;
    let identifyResolved = false;
    if (loadedFromCache && !waitForNetworkResults) {
      this._debugLog('Identify completing with cached flags');
      identifyResolve();
      identifyResolved = true;
    }

    if (offline) {
      if (!startedOffline) {
        // The connection mode changed to offline while we were awaiting the cache. Reject
        // rather than silently resolve so the caller knows the identify did not complete
        // in the originally-requested mode.
        if (!identifyResolved) {
          identifyReject(new Error("Connection mode changed to 'offline' during identify."));
        }
        return;
      }
      if (loadedFromCache) {
        this._debugLog('Offline identify - using cached flags.');
      } else {
        this._debugLog(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
        identifyResolve();
      }
      return;
    }

    if (identifyResolved) {
      this._setupConnection(context);
    } else {
      this._setupConnection(context, identifyResolve, identifyReject);
    }
  }

  private _finishIdentifyFromBootstrap(
    context: Context,
    identifyOpts: LDIdentifyOptions,
    identifyResolve: () => void,
  ): void {
    let { bootstrapParsed } = identifyOpts;
    if (!bootstrapParsed) {
      bootstrapParsed = readFlagsFromBootstrap(this.logger, identifyOpts.bootstrap);
    }
    this.flagManager.setBootstrap(context, bootstrapParsed);
    this.dataSourceStatusManager.requestStateUpdate(DataSourceState.Valid);
    this._debugLog('Identify - Initialization completed from bootstrap');

    identifyResolve();
  }

  private _setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context);
    if (!rawContext) {
      this.logger.error(`${logTag} Unable to convert context; cannot establish connection.`);
      identifyReject?.(new Error('Invalid context.'));
      return;
    }

    // Wrap callbacks so _pendingIdentifyReject is cleared as soon as the identify settles,
    // preventing a stale reject from firing if setConnectionMode runs after resolution.
    const wrappedResolve = identifyResolve
      ? () => {
          this._pendingIdentifyReject = undefined;
          identifyResolve();
        }
      : undefined;
    const wrappedReject = identifyReject
      ? (err: Error) => {
          this._pendingIdentifyReject = undefined;
          identifyReject(err);
        }
      : undefined;
    this._pendingIdentifyReject = wrappedReject;

    const plainContextString = JSON.stringify(rawContext);
    const requestor = makeRequestor(
      plainContextString,
      this.config.serviceEndpoints,
      this.getPollingPaths(),
      this.platform.requests,
      this.platform.encoding!,
      this.baseHeaders,
      [],
      this.config.withReasons,
      this.config.useReport,
      this._currentHash,
    );

    this.updateProcessor?.close();
    switch (this.connectionMode) {
      case 'streaming':
        this.createStreamingProcessor(
          rawContext,
          context,
          requestor,
          wrappedResolve,
          wrappedReject,
        );
        break;
      case 'polling':
        this.createPollingProcessor(
          rawContext,
          context,
          requestor,
          wrappedResolve,
          wrappedReject,
        );
        break;
      default:
        this.logger.warn(
          `${logTag} _setupConnection called with unsupported connectionMode '${this.connectionMode}'.`,
        );
        this.updateProcessor = undefined;
        // connectionMode is an unsupported value; reject the in-flight identify so the
        // promise does not hang until its timeout.
        wrappedReject?.(
          new Error(`Connection mode changed to '${this.connectionMode}' during identify.`),
        );
        return;
    }
    this.updateProcessor!.start();
  }

  async setConnectionMode(
    mode: ConnectionMode,
    flush?: () => Promise<unknown>,
    setEventSendingEnabled?: (enabled: boolean) => void,
  ): Promise<void> {
    const task = this._connectionModeQueue.then(async () => {
      try {
        if (this.closed) {
          this._debugLog('setting connection mode after data manager was closed');
          return;
        }
        if (this.connectionMode === mode) {
          this._debugLog(`setConnectionMode ignored. Mode is already '${mode}'.`);
          return;
        }

        if (mode === 'offline') {
          // Drain queued analytics before tearing down the data source, then stop
          // accepting new events.
          await flush?.();
          setEventSendingEnabled?.(false);
        }

        this.connectionMode = mode;
        this._debugLog(`setConnectionMode ${mode}.`);

        switch (mode) {
          case 'offline':
            // The processor's close() does not invoke pending callbacks, so reject the
            // in-flight identify here to keep its promise from hanging until timeout.
            this._rejectPendingIdentify(
              new Error("Connection mode changed to 'offline' during identify."),
            );
            this.updateProcessor?.close();
            this.updateProcessor = undefined;
            break;
          case 'polling':
          case 'streaming':
            if (this.context) {
              // Reject any in-flight identify from the previous processor before replacing it.
              this._rejectPendingIdentify(
                new Error(`Connection mode changed to '${mode}' during identify.`),
              );
              this._setupConnection(this.context);
            }
            break;
          default:
            this.logger.warn(
              `Unknown ConnectionMode: ${mode}. Only 'offline', 'streaming', and 'polling' are supported.`,
            );
            break;
        }
      } finally {
        // Re-sync event-sending against the mode that actually took effect, even on early
        // returns and failures. Skip when closed -- a closed client must not restart event
        // sending or any side effects gated on the enabled flag.
        if (!this.closed) {
          setEventSendingEnabled?.(this.connectionMode !== 'offline');
        }
      }
    });
    // Keep the queue alive even if a transition fails; the failure still propagates to this caller.
    this._connectionModeQueue = task.catch(() => {});
    return task;
  }

  getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }

  override close(): void {
    this._rejectPendingIdentify(new Error('Client has been closed.'));
    super.close();
  }
}
