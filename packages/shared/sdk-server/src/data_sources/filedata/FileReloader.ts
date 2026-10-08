import { Filesystem, LDLogger, monotonicNow } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../evaluation/data/Flag';
import { FileDataDocument, isFileNotFoundError } from './document';
import { FileDataPolicy } from './FileDataPolicy';
import { FileSummary, mergeDocuments, MergeResult } from './merge';

/**
 * A settle window long enough to coalesce the burst of change notifications that one file
 * edit produces, and short enough to stay responsive.
 *
 * @internal
 */
export const DEFAULT_DEBOUNCE_DELAY_MS = 100;

/**
 * Bounds how long a failed reload can go uncorrected when no further change notification
 * arrives, for example when the failure came from reading a file while it was written.
 * Reading a local file is cheap, so this can be short.
 *
 * @internal
 */
export const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * The longest a burst of change notifications can delay a reload. A settle window restarts with
 * each notification, so a sustained stream of notifications could postpone a reload without end.
 * A reload runs no later than this long after the first notification of a burst.
 *
 * @internal
 */
export const MAX_DEBOUNCE_DELAY_MS = 1000;

/**
 * The result of one successful reload: the merged items plus a summary of each configured
 * file.
 *
 * @internal
 */
export interface ReloadResult extends MergeResult {
  /**
   * One summary for each configured file, in order.
   */
  files: FileSummary[];
}

/**
 * Why a load failed.
 *
 * - `read`: a file could not be read. `path` names it. `error` is the filesystem error.
 * - `parse`: a file could not be parsed. `path` names it. `error` is the parser's error.
 * - `merge`: the documents could not be combined, for example because of a duplicate key.
 * - `apply`: the consumer's `apply` threw while translating or storing the merged result, for
 *   example because an entry is not an object. The result is not remembered as the last good one.
 *
 * @internal
 */
export type LoadFailureKind = 'read' | 'parse' | 'merge' | 'apply';

/**
 * A failed load. `repeated` is true when an automatic retry hit a failure of the same kind and
 * path as the previous report, with no success in between. A failure after a change
 * notification is never a repeat: the files changed, so their failure is news. The message is
 * not compared: a file that is being written fails to parse with a different message on each
 * attempt, and that is one problem. Consumers use it to report a persistent failure once.
 *
 * @internal
 */
export interface LoadFailure {
  kind: LoadFailureKind;
  error: Error;
  path?: string;
  repeated: boolean;
}

/**
 * @internal
 */
export interface FileReloaderConfig {
  /**
   * The files to load. The order is significant: it decides which file wins under the policy's
   * duplicate key resolution.
   */
  paths: string[];
  /**
   * How documents become data.
   */
  policy: FileDataPolicy;
  filesystem: Filesystem;
  logger?: LDLogger;
  /**
   * Receives each successfully merged result. Calls are serialized: one reload completes before
   * the next starts.
   */
  apply: (result: ReloadResult) => void;
  /**
   * Receives each failed load. The reloader does not log failures itself. The consumer decides
   * how to report them, and can use `repeated` to report a persistent failure once.
   */
  onFailure: (failure: LoadFailure) => void;
  /**
   * How long to wait after a trigger for further triggers to settle before reloading. Zero or
   * negative reloads immediately on each trigger.
   */
  debounceDelayMs: number;
  /**
   * How long to wait after a failed reload before retrying it without a trigger. Zero or
   * negative disables the automatic retry.
   */
  retryDelayMs: number;
  /**
   * When true, a reload whose file contents are identical to the last applied contents does not
   * call `apply`.
   */
  skipUnchanged: boolean;
}

type ReloadReason = 'initial' | 'change' | 'retry';

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Owns the reload cycle for a set of data files. It serializes reloads, debounces change
 * signals, keeps the last good result on failure (by not calling `apply`), retries after
 * failures, and skips no-op applications.
 *
 * @internal
 */
export default class FileReloader {
  private _closed = false;

  // Every reload is chained onto this promise, so reloads never overlap.
  private _chain: Promise<void> = Promise.resolve();

  // The reload that waits for the chain, if any. Further requests join it.
  private _queued?: Promise<void>;

  private _debounceTimer?: ReturnType<typeof setTimeout>;

  // When the current burst of triggers began. A reload runs no later than MAX_DEBOUNCE_DELAY_MS
  // after it.
  private _burstStartedAt = 0;

  private _retryTimer?: ReturnType<typeof setTimeout>;

  private _lastGoodContent?: string;

  // The flags of the last applied result, keyed by their key property, for the policy's version
  // handling. A failed reload leaves them as they were.
  private _lastGoodFlags: Record<string, Flag> = {};

  private _lastFailureKey?: string;

  constructor(private readonly _config: FileReloaderConfig) {}

  /**
   * Loads the files and applies the result, or reports the failure. Use it for the initial
   * load. A failure schedules the same automatic retry as a failed triggered reload.
   *
   * @returns A promise that resolves when this reload has completed. It never rejects.
   */
  reloadNow(): Promise<void> {
    return this._enqueue('initial');
  }

  /**
   * Signals that the files may have changed. The reload happens after the debounce delay, or no
   * later than the maximum debounce delay after the first trigger of a burst. Triggers that
   * arrive while a reload is pending are coalesced into it.
   */
  trigger(): void {
    if (this._closed) {
      return;
    }
    if (this._config.debounceDelayMs <= 0) {
      this._enqueue('change');
      return;
    }
    // A monotonic clock, so that a wall-clock adjustment cannot lengthen or cut short the bound.
    const now = monotonicNow();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    } else {
      this._burstStartedAt = now;
    }
    // Each trigger moves the deadline out again, so the reload runs after activity settles. A
    // burst that does not settle cannot postpone the reload past the maximum delay.
    const remaining = this._burstStartedAt + MAX_DEBOUNCE_DELAY_MS - now;
    if (remaining <= 0) {
      this._enqueue('change');
      return;
    }
    this._debounceTimer = setTimeout(
      () => {
        this._debounceTimer = undefined;
        this._enqueue('change');
      },
      Math.min(this._config.debounceDelayMs, remaining),
    );
  }

  /**
   * Stops the reloader. A reload that is in progress finishes its file reads, but it does not
   * call `apply` or `onFailure`.
   */
  close(): void {
    this._closed = true;
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    this._clearRetry();
  }

  private _enqueue(reason: ReloadReason): Promise<void> {
    if (this._queued) {
      return this._queued;
    }
    const run = this._chain.then(() => {
      this._queued = undefined;
      return this._reload(reason).catch((err) => {
        // The reload reports every failure it can foresee. This is the last line of defense, so
        // that one unexpected exception cannot reject a promise the caller dropped.
        this._config.logger?.error(`Unexpected error while reloading flag data: ${err}`);
      });
    });
    this._queued = run;
    // The chain must never be a rejected promise. A later then on it would skip its callback,
    // leave the queued reload set forever, and no reload would ever run again.
    this._chain = run.catch(() => undefined);
    return run;
  }

  private _clearRetry(): void {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = undefined;
    }
  }

  private _armRetry(): void {
    if (this._closed || this._config.retryDelayMs <= 0) {
      return;
    }
    this._clearRetry();
    this._retryTimer = setTimeout(() => {
      this._retryTimer = undefined;
      this._enqueue('retry');
    }, this._config.retryDelayMs);
  }

  /**
   * Performs one full load of all configured files. The whole set is read on every reload.
   * Entries are combined across files in order, so a change to one file can alter which file
   * wins for a key. Every filesystem and parsing failure is caught and reported, so the returned
   * promise never rejects.
   */
  private async _reload(reason: ReloadReason): Promise<void> {
    if (this._closed) {
      return;
    }
    const { logger, paths, policy } = this._config;
    if (reason === 'change') {
      logger?.info('Reloading flag data after detecting a change');
    } else if (reason === 'retry') {
      logger?.debug('Retrying flag data load after earlier failure');
    }
    // A pending retry is superseded by this reload. It either succeeds, or it fails and arms a
    // fresh retry.
    this._clearRetry();

    const documents: FileDataDocument[] = [];
    const files: FileSummary[] = [];
    const contents: string[] = [];
    let failure: LoadFailure | undefined;

    const readAll = paths.reduce(
      (previous, path) =>
        previous.then(async () => {
          if (failure) {
            return;
          }
          let data: string;
          try {
            data = await this._config.filesystem.readFile(path);
          } catch (err) {
            if (policy.missingFile === 'skip' && isFileNotFoundError(err)) {
              logger?.debug(`File ${path} does not exist. It contributes no data.`);
              files.push({ path, present: false, flags: 0, segments: 0 });
              return;
            }
            failure = { kind: 'read', error: asError(err), path, repeated: false };
            return;
          }
          contents.push(data);
          try {
            documents.push(policy.parseDocument(path, data));
          } catch (err) {
            failure = { kind: 'parse', error: asError(err), path, repeated: false };
            return;
          }
          files.push({ path, present: true, flags: 0, segments: 0 });
        }),
      Promise.resolve(),
    );
    await readAll;

    let merged: MergeResult | undefined;
    if (!failure) {
      try {
        merged = mergeDocuments(policy, documents, this._lastGoodFlags);
      } catch (err) {
        failure = { kind: 'merge', error: asError(err), repeated: false };
      }
    }
    if (failure || !merged) {
      this._fail(failure!, reason);
      return;
    }

    // The documents are the present files in order. Copy their counts onto the summaries.
    let next = 0;
    files.forEach((file) => {
      if (file.present) {
        file.flags = merged!.documents[next].flags;
        file.segments = merged!.documents[next].segments;
        next += 1;
      }
    });

    // The reloader may have been closed while the files were read. Deliver nothing then.
    if (this._closed) {
      return;
    }

    // A success right after a failure applies even when the content is unchanged since the
    // last success. The consumer heard about the failure and only `apply` tells it that things
    // are good again.
    const recovering = this._lastFailureKey !== undefined;
    const content = JSON.stringify(contents);
    if (this._config.skipUnchanged && !recovering && content === this._lastGoodContent) {
      this._lastFailureKey = undefined;
      return;
    }
    // Nothing is remembered until the consumer has accepted the result. A result the consumer
    // rejects must not become the baseline that skip-unchanged compares against, and must not
    // count as a recovery.
    const nextFlags: Record<string, Flag> = {};
    try {
      merged.flags.forEach(({ item }) => {
        nextFlags[String(item.key)] = item;
      });
      this._config.apply({ ...merged, files });
    } catch (err) {
      this._fail({ kind: 'apply', error: asError(err), repeated: false }, reason);
      return;
    }
    this._lastFailureKey = undefined;
    this._lastGoodContent = content;
    this._lastGoodFlags = nextFlags;
  }

  private _fail(failure: LoadFailure, reason: ReloadReason): void {
    if (this._closed) {
      return;
    }
    // With automatic retries, a persistent failure would repeat the same report on every
    // attempt. The consumer learns that the failure is a repeat and can demote it. Only a retry
    // can be a repeat: a failure after a change notification is news. The key leaves out the
    // message, because a file that is being written fails with a different parse message on
    // each attempt and that is one problem, not many.
    const key = `${failure.kind}:${failure.path ?? ''}`;
    const repeated = reason === 'retry' && key === this._lastFailureKey;
    this._lastFailureKey = key;
    try {
      this._config.onFailure({ ...failure, repeated });
    } catch (err) {
      // A consumer that throws while it reports a failure must not stop the retry.
      this._config.logger?.error(`Error while reporting a flag data load failure: ${err}`);
    }
    this._armRetry();
  }
}
