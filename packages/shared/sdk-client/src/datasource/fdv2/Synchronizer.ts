import { FDv2SourceResult } from './FDv2SourceResult';

/**
 * Interface for an asynchronous data source synchronizer.
 *
 * A synchronizer runs continuously and produces a stream of results via
 * successive calls to `next()`. When it experiences a temporary failure,
 * it emits an INTERRUPTED result while attempting to recover. When it
 * receives data, it emits a CHANGESET result. When shut down gracefully,
 * it emits a SHUTDOWN result.
 *
 * `next()` is intended to be driven by a single caller, with one outstanding
 * call at a time. Once SHUTDOWN or TERMINAL_ERROR has been produced, no
 * further calls to `next()` should be made.
 *
 * ```
 *       [START]
 *          │
 *          ▼
 *    ┌─────────┐
 * ┌─►│ RUNNING │──┐
 * │  └─────────┘  │
 * │   │  │  │  │  └──► SHUTDOWN ──────► [END]
 * │   │  │  │  └─────► TERMINAL_ERROR ► [END]
 * │   │  │  └────────► GOODBYE ───────┐
 * │   │  └───────────► CHANGESET ─────┤
 * │   └──────────────► INTERRUPTED ───┤
 * └───────────────────────────────────┘
 * ```
 */
export interface Synchronizer {
  /**
   * Get the next result from the stream.
   *
   * This method is intended to be driven by a single caller, and for there
   * to be a single outstanding call at any given time.
   *
   * Once SHUTDOWN or TERMINAL_ERROR has been produced, no further calls to
   * `next()` should be made.
   *
   * @returns A promise that resolves when the next result is available.
   */
  next(): Promise<FDv2SourceResult>;

  /**
   * Close the synchronizer. The next call to `next()` will resolve with a
   * shutdown result.
   */
  close(): void;
}
