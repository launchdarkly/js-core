import { LDLogger } from '@launchdarkly/js-sdk-common';

import { FDv2Requestor } from './FDv2Requestor';
import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { Initializer } from './Initializer';
import { poll } from './PollingBase';

/**
 * Creates a one-shot polling initializer that performs a single FDv2 poll
 * request and returns the result.
 *
 * All errors are treated as terminal (oneShot=true). If `close()` is called
 * before the poll completes, the result will be a shutdown status.
 *
 * @internal
 */
export function createPollingInitializer(
  requestor: FDv2Requestor,
  logger: LDLogger | undefined,
  selectorGetter: () => string | undefined,
): Initializer {
  let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
  const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
    shutdownResolve = resolve;
  });

  return {
    async run(): Promise<FDv2SourceResult> {
      const pollResult = poll(requestor, selectorGetter(), true, logger);

      // Race the poll against the shutdown signal
      return Promise.race([shutdownPromise, pollResult]);
    },

    close(): void {
      shutdownResolve?.(shutdown());
      shutdownResolve = undefined;
    },
  };
}
