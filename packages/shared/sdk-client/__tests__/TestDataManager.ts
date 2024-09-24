import { Context } from '@launchdarkly/js-sdk-common';

import { LDIdentifyOptions } from '../src/api';
import { BaseDataManager } from '../src/DataManager';

export default class TestDataManager extends BaseDataManager {
  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults;

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

    this.setupConnection(context, identifyResolve, identifyReject);
  }

  private setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;

    this.updateProcessor?.close();

    this.createStreamingProcessor(rawContext, context, identifyResolve, identifyReject);

    this.updateProcessor!.start();
  }
}
