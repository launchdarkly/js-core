import { Filesystem, LDLogger } from '@launchdarkly/js-sdk-common';

import {
  FileDataDocument,
  FileDataReadError,
  isFileNotFoundError,
  parseDocument,
  YamlParser,
} from './document';
import { DuplicateKeysHandling, FileSummary, mergeDocuments, MergeResult } from './merge';

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
 * @internal
 */
export interface FileReloaderConfig {
  /**
   * The files to load. The order is significant: it decides which file wins under the
   * duplicate keys handling.
   */
  paths: string[];
  duplicateKeysHandling: DuplicateKeysHandling;
  /**
   * When true, a configured file that does not exist is a file with no content. The reload
   * succeeds with the data of the files that exist. When false, a missing file fails the reload
   * like any other read error.
   */
  skipMissingPaths: boolean;
  filesystem: Filesystem;
  yamlParser?: YamlParser;
  logger?: LDLogger;
  /**
   * Receives each successfully merged result. Calls are serialized: one reload completes before
   * the next starts.
   */
  apply: (result: ReloadResult) => void;
  /**
   * Receives each distinct failure once. With automatic retries, repeats of an identical
   * failure do not invoke it again. A success re-arms it. The reloader logs failures itself.
   */
  onError?: (err: Error) => void;
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

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

  private _retryTimer?: ReturnType<typeof setTimeout>;

  private _lastGoodContent?: string;

  private _lastErrorMessage?: string;

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
   * Signals that the files may have changed. The reload happens after the debounce delay.
   * Triggers that arrive while a reload is pending are coalesced into it.
   */
  trigger(): void {
    if (this._closed) {
      return;
    }
    if (this._config.debounceDelayMs <= 0) {
      this._enqueue('change');
      return;
    }
    // Each trigger moves the deadline out again, so the reload runs after activity settles.
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = undefined;
      this._enqueue('change');
    }, this._config.debounceDelayMs);
  }

  /**
   * Stops the reloader. A reload that is in progress finishes its file reads, but it does not
   * call `apply` or `onError`.
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
      return this._reload(reason);
    });
    this._queued = run;
    this._chain = run;
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
   * wins for a key.
   */
  private async _reload(reason: ReloadReason): Promise<void> {
    if (this._closed) {
      return;
    }
    const { logger, paths } = this._config;
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

    const readAll = paths.reduce(
      (previous, path) =>
        previous.then(async () => {
          let data: string;
          try {
            data = await this._config.filesystem.readFile(path);
          } catch (err) {
            if (this._config.skipMissingPaths && isFileNotFoundError(err)) {
              logger?.debug(`File ${path} does not exist. It contributes no data.`);
              files.push({ path, present: false, flags: 0, segments: 0 });
              return;
            }
            throw new FileDataReadError(`unable to read file: ${messageOf(err)}`, path);
          }
          contents.push(data);
          try {
            documents.push(parseDocument(path, data, this._config.yamlParser));
          } catch (err) {
            throw new FileDataReadError(`error parsing file: ${messageOf(err)}`, path);
          }
          files.push({ path, present: true, flags: 0, segments: 0 });
        }),
      Promise.resolve(),
    );

    let merged: MergeResult;
    try {
      await readAll;
      merged = mergeDocuments(this._config.duplicateKeysHandling, documents);
    } catch (err) {
      this._fail(err as Error);
      return;
    }

    // The documents are the present files in order. Copy their counts onto the summaries.
    let next = 0;
    files.forEach((file) => {
      if (file.present) {
        // eslint-disable-next-line no-param-reassign
        file.flags = merged.documents[next].flags;
        // eslint-disable-next-line no-param-reassign
        file.segments = merged.documents[next].segments;
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
    const recovering = this._lastErrorMessage !== undefined;
    this._lastErrorMessage = undefined;
    const content = JSON.stringify(contents);
    if (this._config.skipUnchanged && !recovering && content === this._lastGoodContent) {
      return;
    }
    this._lastGoodContent = content;
    this._config.apply({ ...merged, files });
  }

  private _fail(err: Error): void {
    if (this._closed) {
      return;
    }
    // With automatic retries, a persistent failure would repeat the same log entry and the same
    // callback on every attempt. Repeats of an identical failure are logged at debug level and
    // do not invoke `onError` again, so consumers see one report per distinct failure.
    if (err.message === this._lastErrorMessage) {
      this._config.logger?.debug(`Unable to load flags: ${err.message}`);
    } else {
      this._lastErrorMessage = err.message;
      this._config.logger?.error(`Unable to load flags: ${err.message}`);
      this._config.onError?.(err);
    }
    this._armRetry();
  }
}
