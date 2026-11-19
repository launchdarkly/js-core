import {
  BaseDataManager,
  Configuration,
  ConnectionMode,
  Context,
  DataSourcePaths,
  FlagManager,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  makeRequestor,
  Platform,
  readFlagsFromBootstrap,
} from '@launchdarkly/js-client-sdk-common';

import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import type { ValidatedOptions } from './options';

const logTag = '[ElectronDataManager]';

export default class ElectronDataManager extends BaseDataManager {
  // The network counts as available until the application reports otherwise.
  protected networkAvailable: boolean = true;
  protected connectionMode: ConnectionMode = 'streaming';
  private _currentHash?: string;

  // The callbacks of an identify that has not yet completed. They survive a pause or a mode
  // switch so the connection that replaces the closed one can still complete the identify.
  private _pendingIdentify?: { resolve: () => void; reject: (err: Error) => void };

  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    private readonly _electronConfig: ValidatedOptions,
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
    this.connectionMode = _electronConfig.initialConnectionMode;
    this._currentHash = _electronConfig.hash;
  }

  private _debugLog(message: any, ...args: any[]) {
    this.logger.debug(`${logTag} ${message}`, ...args);
  }

  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    if (this.closed) {
      this._debugLog('Identify called after data manager was closed.');
      identifyResolve();
      return;
    }
    this.context = context;
    // The identify queue runs one identify at a time, so the previous identify has already settled.
    this._pendingIdentify = undefined;
    const electronIdentifyOptions = identifyOptions as ElectronIdentifyOptions | undefined;
    // An empty string counts as no hash, so callers can pass one variable in every mode.
    this._currentHash = electronIdentifyOptions?.hash || this._electronConfig.hash;
    if (this._currentHash && !this._electronConfig.useClientSideId) {
      this.logger.warn(`${logTag} 'hash' is ignored in mobile key mode.`);
      this._currentHash = undefined;
    }
    if (this._currentHash) {
      this.setConnectionParams({ queryParameters: [{ key: 'h', value: this._currentHash }] });
    } else {
      this.setConnectionParams();
    }

    // When bootstrap is provided, we will resolve the identify immediately. Then we will fallthrough to connect
    // to the configured connection mode.
    if (identifyOptions?.bootstrap) {
      this._finishIdentifyFromBootstrap(context, identifyOptions, identifyResolve);
    }
    // Bootstrap path already called resolve so we use this to prevent duplicate resolve calls.
    const resolvedFromBootstrap = !!identifyOptions?.bootstrap;

    const offline = this.connectionMode === 'offline';
    // In offline mode we do not support waiting for results.
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !offline;

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (this.closed) {
      this._debugLog('Identify - data manager closed while loading cached flags.');
      // The identify must not stay unsettled. Bootstrap has already resolved its own.
      if (!resolvedFromBootstrap) {
        identifyResolve();
      }
      return;
    }
    if (loadedFromCache && !waitForNetworkResults && !resolvedFromBootstrap) {
      this._debugLog('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this._debugLog(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    // The mode can change during the cache load, so read it again here.
    if (this.connectionMode === 'offline') {
      if (loadedFromCache) {
        this._debugLog('Offline identify - using cached flags.');
      } else {
        this._debugLog(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
      }
      // No network result can arrive, so a waiting identify completes with what is loaded.
      if ((!loadedFromCache || waitForNetworkResults) && !resolvedFromBootstrap) {
        identifyResolve();
      }
    } else if (!this.networkAvailable) {
      // No network result can arrive, so the identify completes with what is loaded. The
      // connection opens when the application reports the network as available again.
      this._debugLog(
        'Identify - network unavailable, the connection starts when the network returns.',
      );
      if ((!loadedFromCache || waitForNetworkResults) && !resolvedFromBootstrap) {
        identifyResolve();
      }
    } else {
      // Context has been validated in LDClientImpl.identify
      // A late settle from a superseded identify must not clear the newer identify's callbacks,
      // so each wrapper clears the slot only when it still owns it.
      const pending = {
        resolve: () => {
          if (this._pendingIdentify === pending) {
            this._pendingIdentify = undefined;
          }
          identifyResolve();
        },
        reject: (err: Error) => {
          if (this._pendingIdentify === pending) {
            this._pendingIdentify = undefined;
          }
          identifyReject(err);
        },
      };
      this._pendingIdentify = pending;
      this._setupConnection(context);
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
    this._debugLog('Identify - Initialization completed from bootstrap');

    identifyResolve();
  }

  // Completes the pending identify with what is already loaded, because no network result can
  // arrive on a closed connection.
  private _resolvePendingIdentify(): void {
    const pending = this._pendingIdentify;
    this._pendingIdentify = undefined;
    pending?.resolve();
  }

  private _setupConnection(context: Context) {
    if (this.closed) {
      return;
    }
    const identifyResolve = this._pendingIdentify?.resolve;
    const identifyReject = this._pendingIdentify?.reject;
    const rawContext = Context.toLDContext(context)!;

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
          identifyResolve,
          identifyReject,
        );
        break;
      case 'polling':
        this.createPollingProcessor(
          rawContext,
          context,
          requestor,
          identifyResolve,
          identifyReject,
        );
        break;
      default:
        // An unknown mode opens no connection.
        break;
    }
    this.updateProcessor?.start();
  }

  override close(): void {
    this._resolvePendingIdentify();
    super.close();
  }

  setNetworkAvailability(available: boolean): void {
    if (this.closed) {
      this._debugLog('setNetworkAvailability called after data manager was closed.');
      return;
    }
    if (this.networkAvailable === available) {
      return;
    }
    this.networkAvailable = available;

    if (!available) {
      // Pause only. The connection mode is unchanged so the resume uses the same mode.
      this._debugLog('Network unavailable - pausing the connection.');
      this.updateProcessor?.close();
      this.updateProcessor = undefined;
      this._resolvePendingIdentify();
      return;
    }

    if (this.connectionMode !== 'offline' && this.context) {
      this._debugLog(`Network available - resuming the ${this.connectionMode} connection.`);
      this._setupConnection(this.context);
    }
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    if (this.closed) {
      this._debugLog('setting connection mode after data manager was closed');
      return;
    }

    if (this.connectionMode === mode) {
      this._debugLog(`setConnectionMode ignored. Mode is already '${mode}'.`);
      return;
    }

    if (mode !== 'offline' && mode !== 'streaming' && mode !== 'polling') {
      this.logger.warn(
        `Unknown ConnectionMode: ${JSON.stringify(String(mode).slice(0, 64))}. Only 'offline', 'streaming', and 'polling' are supported.`,
      );
      return;
    }

    this.connectionMode = mode;
    this._debugLog(`setConnectionMode ${mode}.`);

    switch (mode) {
      case 'offline':
        this.updateProcessor?.close();
        this._resolvePendingIdentify();
        break;
      case 'polling':
      case 'streaming':
        if (this.context && this.networkAvailable) {
          // Without a context, identify opens the connection. Without a network,
          // setNetworkAvailability opens it when the network returns.
          this._setupConnection(this.context);
        }

        break;
      default:
        break;
    }
  }

  getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }
}
