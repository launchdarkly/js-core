import { FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { Initializer } from './Initializer';
import { StreamingFDv2Base } from './StreamingFDv2Base';

/**
 * Creates a one-shot streaming initializer for FDv2.
 *
 * Connects to the FDv2 streaming endpoint, waits for the first result
 * (a change set or an error status), then disconnects. Used in browser
 * `one-shot` mode where a persistent connection is not desired.
 *
 * If `close()` is called before a result arrives, the returned promise
 * resolves with a shutdown result.
 *
 * @param base - The streaming base that manages the EventSource connection.
 * @internal
 */
export function createStreamingInitializer(base: StreamingFDv2Base): Initializer {
  let closed = false;
  let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
  const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
    shutdownResolve = resolve;
  });

  return {
    run(): Promise<FDv2SourceResult> {
      if (closed) {
        return Promise.resolve(shutdown());
      }

      base.start();

      return Promise.race([
        base.takeResult().then((result) => {
          // Got our first result — close the connection.
          base.close();
          return result;
        }),
        shutdownPromise,
      ]);
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
