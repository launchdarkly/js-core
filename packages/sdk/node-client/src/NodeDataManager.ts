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

import type { ValidatedOptions } from './options';

const logTag = '[NodeDataManager]';

export default class NodeDataManager extends BaseDataManager {
  protected networkAvailable: boolean = true;
  protected connectionMode: ConnectionMode = 'streaming';

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
      return;
    }
    this.context = context;

    if (identifyOptions?.bootstrap) {
      this._finishIdentifyFromBootstrap(context, identifyOptions, identifyResolve);
    }
    const resolvedFromBootstrap = !!identifyOptions?.bootstrap;

    const offline = this.connectionMode === 'offline';
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !offline;

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (loadedFromCache && !waitForNetworkResults && !resolvedFromBootstrap) {
      this._debugLog('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this._debugLog(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    if (this.connectionMode === 'offline') {
      if (loadedFromCache) {
        this._debugLog('Offline identify - using cached flags.');
      } else {
        this._debugLog(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
        if (!resolvedFromBootstrap) {
          identifyResolve();
        }
      }
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
    this._debugLog('Identify - Initialization completed from bootstrap');

    identifyResolve();
  }

  private _setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
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
      this._nodeConfig.hash,
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
        break;
    }
    this.updateProcessor!.start();
  }

  setNetworkAvailability(available: boolean): void {
    this.networkAvailable = available;
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

    this.connectionMode = mode;
    this._debugLog(`setConnectionMode ${mode}.`);

    switch (mode) {
      case 'offline':
        this.updateProcessor?.close();
        break;
      case 'polling':
      case 'streaming':
        if (this.context) {
          this._setupConnection(this.context);
        }
        break;
      default:
        this.logger.warn(
          `Unknown ConnectionMode: ${mode}. Only 'offline', 'streaming', and 'polling' are supported.`,
        );
        break;
    }
  }

  getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }
}
