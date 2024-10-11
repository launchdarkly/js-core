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
} from '@launchdarkly/js-client-sdk-common';

import { ValidatedOptions } from './options';

const logTag = '[MobileDataManager]';

export default class MobileDataManager extends BaseDataManager {
  // Not implemented yet.
  protected networkAvailable: boolean = true;
  protected connectionMode: ConnectionMode = 'streaming';

  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    private readonly rnConfig: ValidatedOptions,
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
    this.connectionMode = rnConfig.initialConnectionMode;
  }

  private debugLog(message: any, ...args: any[]) {
    this.logger.debug(`${logTag} ${message}`, ...args);
  }

  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    const offline = this.connectionMode === 'offline';
    // In offline mode we do not support waiting for results.
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !offline;

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (loadedFromCache && !waitForNetworkResults) {
      this.debugLog('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this.debugLog(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    if (this.connectionMode === 'offline') {
      if (loadedFromCache) {
        this.debugLog('Offline identify - using cached flags.');
      } else {
        this.debugLog(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
        identifyResolve();
      }
    } else {
      // Context has been validated in LDClientImpl.identify
      this.setupConnection(context, identifyResolve, identifyReject);
    }
  }

  private setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;

    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const requestor = makeRequestor(
      plainContextString,
      this.config.serviceEndpoints,
      this.getPollingPaths(), // note: this is the polling path because the requestor is only used to make polling requests.
      this.platform.requests,
      this.platform.encoding!,
      this.baseHeaders,
      [],
      this.config.useReport,
      this.config.withReasons,
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
    if (this.connectionMode === mode) {
      this.debugLog(`setConnectionMode ignored. Mode is already '${mode}'.`);
      return;
    }

    this.connectionMode = mode;
    this.debugLog(`setConnectionMode ${mode}.`);

    switch (mode) {
      case 'offline':
        this.updateProcessor?.close();
        break;
      case 'polling':
      case 'streaming':
        if (this.context) {
          // identify will start the update processor
          this.setupConnection(this.context);
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
