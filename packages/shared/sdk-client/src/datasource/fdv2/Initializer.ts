import { FDv2SourceResult } from './FDv2SourceResult';

/**
 * Interface for an asynchronous data source initializer.
 *
 * An initializer runs once and produces a single result. If successful, the
 * result contains a change set with flag data. If it fails, the result
 * contains a status describing the error.
 *
 * Once `run()` resolves, the initializer is complete and should not be
 * called again. Use `close()` to cancel a pending run.
 *
 * ```
 *     [START]
 *        │
 *        ▼
 *   ┌─────────┐
 *   │ RUNNING │──┐
 *   └─────────┘  │
 *    │  │  │  │  └──► SHUTDOWN ──► [END]
 *    │  │  │  └─────► INTERRUPTED ──► [END]
 *    │  │  └────────► CHANGESET ──► [END]
 *    │  └───────────► TERMINAL_ERROR ──► [END]
 *    └──────────────► GOODBYE ──► [END]
 * ```
 */
export interface Initializer {
  /**
   * Run the initializer to completion.
   *
   * This method is intended to be called only a single time for an instance.
   * @returns The result of the initializer.
   */
  run(): Promise<FDv2SourceResult>;

  /**
   * Close the initializer. If `run()` is in progress, it will resolve with
   * a shutdown result.
   */
  close(): void;
}
