import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { StreamingFDv2Base } from './StreamingFDv2Base';
import { Synchronizer } from './Synchronizer';

/**
 * Creates a long-lived streaming synchronizer for FDv2.
 *
 * Maintains a persistent EventSource connection to the FDv2 streaming
 * endpoint and produces a stream of results via the pull-based `next()`
 * method. Used in streaming connection mode.
 *
 * The connection is started lazily on the first call to `next()`.
 * On `close()`, the next call to `next()` returns a shutdown result.
 *
 * @param base - The streaming base that manages the EventSource connection.
 * @internal
 */
export function createStreamingSynchronizer(base: StreamingFDv2Base): Synchronizer {
  let started = false;
  let closed = false;
  let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
  const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
    shutdownResolve = resolve;
  });

  return {
    next(): Promise<FDv2SourceResult> {
      if (closed) {
        return Promise.resolve(shutdown());
      }

      if (!started) {
        started = true;
        base.start();
      }

      return Promise.race([base.takeResult(), shutdownPromise]);
    },

    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      base.close();
      shutdownResolve?.(shutdown());
      shutdownResolve = undefined;
    },
  };
}
