import {
  ConnectionMode,
  Context,
  DefaultDataManager,
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

export default class MobileDataManager extends DefaultDataManager {
  // Not implemented yet.
  protected networkAvailable: boolean = true;
  protected connectionMode: ConnectionMode = 'streaming';

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
      this.logger.debug('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this.logger.debug(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    if (this.connectionMode === 'offline') {
      if (loadedFromCache) {
        this.logger.debug('Offline identify - using cached flags.');
      } else {
        this.logger.debug(
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

    this.updateProcessor?.close();
    switch (this.connectionMode) {
      case 'streaming':
        this.createStreamingProcessor(rawContext, context, identifyResolve, identifyReject);
        break;
      case 'polling':
        this.createPollingProcessor(rawContext, context, identifyResolve, identifyReject);
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
      this.logger.debug(`setConnectionMode ignored. Mode is already '${mode}'.`);
      return;
    }

    this.connectionMode = mode;
    this.logger.debug(`setConnectionMode ${mode}.`);

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
