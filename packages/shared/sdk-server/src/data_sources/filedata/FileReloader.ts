import { Filesystem, LDLogger, monotonicNow } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../evaluation/data/Flag';
import { FileDataDocument, hasContent, isFileNotFoundError, NO_ENTRIES } from './document';
import { FileDataPolicy } from './FileDataPolicy';
import { FileState, observeFile, sameFileState } from './FilePoller';
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
 * Reloads stop holding a file back once they have held it back for this many retry delays, so
 * that a file that keeps being written while every reload finds it empty, or files that are
 * rewritten in turn, are not held back without end.
 *
 * @internal
 */
export const MAX_HOLD_RETRY_DELAYS = 5;

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
   * How long to wait after a failed reload before retrying it without a trigger. A file whose
   * content is in effect and that is found empty is not applied until it has stayed empty, without
   * being written, for the same delay, or until reloads have held it back for
   * `MAX_HOLD_RETRY_DELAYS` times the delay. Zero or negative disables the automatic retry, and an
   * empty file is then parsed as it is.
   */
  retryDelayMs: number;
  /**
   * When true, a reload whose file contents are identical to the last applied contents does not
   * call `apply`.
   */
  skipUnchanged: boolean;
}

type ReloadReason = 'initial' | 'change' | 'retry';

/**
 * A file whose content is in effect and that reloads have found empty, with times on the monotonic
 * clock. `since` is since when it has been empty without being written, and `state` its state
 * then; `since` is undefined after a reload found the file with content or missing. `firstHeld` is
 * when a reload first held it back since a reload that held nothing back read it, so that a file
 * that keeps being rewritten, or files that are rewritten in turn, are bounded.
 */
interface EmptyFile {
  since?: number;
  state?: FileState;
  firstHeld?: number;
}

/**
 * Reports whether a parsed document has no entries because the content was no document at all,
 * as a YAML parser reports for a file with only a comment or a document marker.
 */
function isNoDocument(document: FileDataDocument | null | undefined): boolean {
  return document === null || document === undefined || document === NO_ENTRIES;
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Owns the reload cycle for a set of data files. It serializes reloads, debounces change
 * signals, keeps the last good result on failure (by not calling `apply`), retries after
 * failures, and skips no-op applications.
 *
 * A file that is rewritten in place is truncated and then written, so a reload can find it
 * empty. A reload that finds a file empty whose content is in effect keeps the current data and
 * reads the file again later, whatever the file's format. See `_holdsBack`.
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

  // Whether each configured path contributed content to the data in effect, that is, to the last
  // reload that was applied or skipped as unchanged. A missing or empty file contributed none.
  private readonly _appliedHadContent = new Map<string, boolean>();

  // The paths whose content is in effect and that reloads have found empty since.
  private readonly _emptyFiles = new Map<string, EmptyFile>();

  // The delay of the retry that was armed last. Tests read it.
  private _lastRetryDelayMs?: number;

  // Set by a reload that held back an empty file and armed the retry to read it again, to that
  // reload's reason, until the next reload starts. The next reload continues the deferred one, so
  // it reports a failure the way the deferred reload would have.
  private _readAgainReason?: ReloadReason;

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
   * The delay of the retry that was armed last, in milliseconds, if any. For tests.
   *
   * @internal
   */
  get lastRetryDelayMs(): number | undefined {
    return this._lastRetryDelayMs;
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

  private _armRetry(delayMs: number = this._config.retryDelayMs): void {
    if (this._closed || this._config.retryDelayMs <= 0) {
      return;
    }
    this._clearRetry();
    this._lastRetryDelayMs = delayMs;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = undefined;
      this._enqueue('retry');
    }, delayMs);
  }

  /**
   * Performs one full load of all configured files. The whole set is read on every reload.
   * Entries are combined across files in order, so a change to one file can alter which file
   * wins for a key. Every filesystem and parsing failure is caught and reported, so the returned
   * promise never rejects.
   */
  private async _reload(requested: ReloadReason): Promise<void> {
    if (this._closed) {
      return;
    }
    const { logger, paths, policy } = this._config;
    // The retry that reads an emptied file again continues the reload that found it empty, so a
    // failure is news when it would have been news to that reload.
    const deferredReason = requested === 'retry' ? this._readAgainReason : undefined;
    const reason = deferredReason ?? requested;
    this._readAgainReason = undefined;
    if (requested === 'change') {
      logger?.info('Reloading flag data after detecting a change');
    } else if (deferredReason) {
      logger?.debug('Reading flag data again after a file was found empty');
    } else if (requested === 'retry') {
      logger?.debug('Retrying flag data load after earlier failure');
    }
    // A pending retry is superseded by this reload. It either succeeds, or it fails and arms a
    // fresh retry.
    this._clearRetry();

    const documents: FileDataDocument[] = [];
    const files: FileSummary[] = [];
    const contents: string[] = [];
    // Whether each path that this reload read, or found missing, has content.
    const hadContent = new Map<string, boolean>();
    let failure: LoadFailure | undefined;
    // The empty files that this reload holds back. The other files are still read, so that files
    // that are emptied together start their delays in the same reload.
    const heldBack: string[] = [];

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
            const missing = isFileNotFoundError(err);
            if (missing) {
              this._fileChanged(path);
            }
            if (missing && policy.missingFile === 'skip') {
              logger?.debug(`File ${path} does not exist. It contributes no data.`);
              hadContent.set(path, false);
              files.push({ path, present: false, flags: 0, segments: 0 });
              return;
            }
            failure = { kind: 'read', error: asError(err), path, repeated: false };
            return;
          }
          // A file with no content, or with content that its parser reads as no document, such as
          // YAML with only a comment, has no entries. A read can see that much of a file that is
          // being written. Content with no document is invalid JSON, so it is only parsed when the
          // file is not held back.
          const blank = !hasContent(data);
          let document: FileDataDocument | undefined;
          if (!blank) {
            try {
              document = policy.parseDocument(path, data);
            } catch (err) {
              failure = { kind: 'parse', error: asError(err), path, repeated: false };
              return;
            }
          }
          const noEntries = blank || isNoDocument(document);
          if (!noEntries) {
            this._fileChanged(path);
          } else if (await this._holdsBack(path)) {
            heldBack.push(path);
            return;
          }
          // The file was read and is not held back, whether or not its empty content parses.
          hadContent.set(path, !noEntries);
          if (blank) {
            try {
              document = policy.parseDocument(path, data);
            } catch (err) {
              failure = { kind: 'parse', error: asError(err), path, repeated: false };
              return;
            }
          }
          contents.push(data);
          documents.push(document as FileDataDocument);
          files.push({ path, present: true, flags: 0, segments: 0 });
        }),
      Promise.resolve(),
    );
    await readAll;

    if (heldBack.length === 0) {
      // A reload that holds nothing back, whether it applies, skips or fails, starts the bound over
      // for every file that it read: such a file is no longer held, so its next rewrite is a new
      // one. A file that the reload did not get to keeps its bound.
      hadContent.forEach((_hadContent, path) => {
        const empty = this._emptyFiles.get(path);
        if (empty) {
          empty.firstHeld = undefined;
        }
      });
    }

    // A file that cannot be read or parsed fails the reload, whether or not another file is held
    // back.
    if (!failure && heldBack.length > 0) {
      this._holdBack(heldBack, reason);
      return;
    }

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
      // The contents are compared without their paths, so a file can have moved to another
      // configured path, which now contributes the content in effect.
      this._lastFailureKey = undefined;
      this._rememberAppliedContent(hadContent);
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
    this._rememberAppliedContent(hadContent);
  }

  // Called when the data of a reload is in effect. The files' bounds start over.
  private _rememberAppliedContent(hadContent: Map<string, boolean>): void {
    hadContent.forEach((value, path) => this._appliedHadContent.set(path, value));
    this._emptyFiles.clear();
  }

  // Called when a reload finds a file with content, or missing. The next time a reload finds it
  // empty, its delay starts over. Its bound does not.
  private _fileChanged(path: string): void {
    const empty = this._emptyFiles.get(path);
    if (empty) {
      empty.since = undefined;
    }
  }

  /**
   * Decides whether a reload holds back a file that it found with no entries.
   *
   * A file whose content is in effect and that has none now may be in the middle of an in-place
   * rewrite: a writer that truncates the file and then writes the new content. Such a file is held
   * back until it has stayed so, without being written, for the retry delay. A change of its
   * state, its modification time and size as the platform reports them, means that it was written
   * since a reload last found it so, for example rewritten and truncated again between two
   * reloads, so the delay starts over. A file that keeps being written while every reload finds it
   * empty, or files that are rewritten in turn so that every reload finds one of them empty, would
   * be held back without end, so a file is held back for at most `MAX_HOLD_RETRY_DELAYS` retry
   * delays. That bound is the file's own: it starts at the first reload that holds the file back,
   * and starts over only at a reload that holds nothing back and reads the file, or when data is
   * applied. A file whose content is not in effect, such as a placeholder that has always been empty,
   * is parsed right away, and so is any file when retries are off, since nothing would read it
   * again.
   *
   * The clock is read after the file's own read, so that a slow read of another file does not
   * shorten this file's delay.
   */
  private async _holdsBack(path: string): Promise<boolean> {
    const { retryDelayMs } = this._config;
    if (retryDelayMs <= 0 || this._appliedHadContent.get(path) !== true) {
      return false;
    }
    const state = await observeFile(this._config.filesystem, path);
    const now = monotonicNow();
    let empty = this._emptyFiles.get(path);
    if (!empty) {
      empty = {};
      this._emptyFiles.set(path, empty);
    }
    if (empty.since === undefined || !empty.state || !sameFileState(empty.state, state)) {
      empty.since = now;
      empty.state = state;
    }
    if (now - empty.since >= retryDelayMs) {
      return false;
    }
    if (
      empty.firstHeld !== undefined &&
      now - empty.firstHeld >= MAX_HOLD_RETRY_DELAYS * retryDelayMs
    ) {
      return false;
    }
    empty.firstHeld = empty.firstHeld ?? now;
    return true;
  }

  /**
   * Holds back the files that `_holdsBack` decided to hold back. Whatever their format, the reload
   * keeps the current data and arms the retry without reporting a failure. The retry comes when the
   * first of the files has stayed empty for the retry delay, or has been held back for as long as
   * it may be, plus a tenth of the retry delay, so that a timer that fires a little early still
   * finds the time over. The change signal for a write starts a reload sooner. Once a file has
   * stayed empty for the retry delay, a reload parses it: a file that is still empty is invalid
   * JSON, or a YAML document with no entries.
   */
  private _holdBack(paths: string[], reason: ReloadReason): void {
    if (this._closed) {
      return;
    }
    const { logger, retryDelayMs } = this._config;
    let until = Infinity;
    paths.forEach((path) => {
      logger?.debug(
        `File ${path} is empty, possibly while it is being rewritten; reading it again before applying it`,
      );
      const { since, firstHeld } = this._emptyFiles.get(path)!;
      until = Math.min(
        until,
        since! + retryDelayMs,
        firstHeld! + MAX_HOLD_RETRY_DELAYS * retryDelayMs,
      );
    });
    this._readAgainReason = reason;
    this._armRetry(Math.max(until - monotonicNow(), 0) + retryDelayMs / 10);
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
