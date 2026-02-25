import { LDLogger } from '@launchdarkly/js-sdk-common';

import { FDv2Requestor } from './FDv2Requestor';
import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { Initializer } from './Initializer';
import { poll } from './PollingBase';

/**
 * A one-shot polling initializer that performs a single FDv2 poll request
 * and returns the result.
 *
 * All errors are treated as terminal (oneShot=true). If `close()` is called
 * before the poll completes, the result will be a shutdown status.
 *
 * @internal
 */
export class PollingInitializer implements Initializer {
  private _shutdownResolve?: (result: FDv2SourceResult) => void;
  private readonly _shutdownPromise: Promise<FDv2SourceResult>;

  constructor(
    private readonly _requestor: FDv2Requestor,
    private readonly _logger: LDLogger | undefined,
    private readonly _selectorGetter: () => string | undefined,
  ) {
    this._shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
      this._shutdownResolve = resolve;
    });
  }

  async run(): Promise<FDv2SourceResult> {
    const pollResult = poll(this._requestor, this._selectorGetter(), true, this._logger);

    // Race the poll against the shutdown signal
    return Promise.race([this._shutdownPromise, pollResult]);
  }

  close(): void {
    this._shutdownResolve?.(shutdown());
    this._shutdownResolve = undefined;
  }
}
