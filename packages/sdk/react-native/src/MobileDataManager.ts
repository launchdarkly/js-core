import { Context, DefaultDataManager, LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common';

export default class MobileDataManager extends DefaultDataManager {
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
}
