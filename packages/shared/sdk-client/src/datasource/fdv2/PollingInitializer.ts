import { LDLogger, sleep } from '@launchdarkly/js-sdk-common';

import { FDv2Requestor } from './FDv2Requestor';
import { FDv2SourceResult, shutdown, StatusResult, terminalError } from './FDv2SourceResult';
import { Initializer } from './Initializer';
import { poll } from './PollingBase';

const SHUTDOWN = Symbol('shutdown');

/**
 * Creates a polling initializer that performs an FDv2 poll request with
 * retry logic. Retries up to 3 times on recoverable errors with a 1-second
 * delay between attempts.
 *
 * Unrecoverable errors (401, 403, etc.) are returned immediately as terminal
 * errors. After exhausting retries on recoverable errors, the result is
 * converted to a terminal error.
 *
 * If `close()` is called during a poll or retry delay, the result will be
 * a shutdown status.
 *
 * @internal
 */
export function createPollingInitializer(
  requestor: FDv2Requestor,
  logger: LDLogger | undefined,
  selectorGetter: () => string | undefined,
): Initializer {
  let shutdownResolve: ((value: typeof SHUTDOWN) => void) | undefined;
  const shutdownPromise = new Promise<typeof SHUTDOWN>((resolve) => {
    shutdownResolve = resolve;
  });

  return {
    async run(): Promise<FDv2SourceResult> {
      const maxRetries = 3;
      const retryDelayMs = 1000;
      const selector = selectorGetter();
      let lastResult: FDv2SourceResult | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        const result = await Promise.race([shutdownPromise, poll(requestor, selector, logger)]);

        if (result === SHUTDOWN) {
          return shutdown();
        }

        if (result.type === 'changeSet') {
          return result;
        }

        // Non-retryable status (terminal_error, goodbye) → return immediately
        if (result.state !== 'interrupted') {
          return result;
        }

        // Recoverable error — save and potentially retry
        lastResult = result;

        if (attempt < maxRetries) {
          logger?.warn(
            `Recoverable polling error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${retryDelayMs}ms...`,
          );
          // eslint-disable-next-line no-await-in-loop
          const sleepResult = await Promise.race([shutdownPromise, sleep(retryDelayMs)]);
          if (sleepResult === SHUTDOWN) {
            return shutdown();
          }
        }
      }

      // Convert final interrupted → terminal_error
      const status = lastResult as StatusResult;
      return terminalError(status.errorInfo!, status.fdv1Fallback);
    },

    close(): void {
      shutdownResolve?.(SHUTDOWN);
      shutdownResolve = undefined;
    },
  };
}
