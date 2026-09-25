import { Filesystem, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDOverrideSink, LDOverrideSource } from '../api/subsystems';
import {
  DEFAULT_DEBOUNCE_DELAY_MS,
  DEFAULT_RETRY_DELAY_MS,
  DuplicateKeysHandling,
  FileDirectoryWatcher,
  FilePoller,
  FileReloader,
  ReloadResult,
  YamlParser,
} from '../data_sources/filedata';

/**
 * How the file-based override source learns that a file changed.
 *
 * @internal
 */
export type FileChangeDetection = 'polling' | 'watching';

/**
 * The interval, in seconds, at which the file-based override source examines the files for
 * changes in polling mode when no interval was specified. The source reads local files rather
 * than contacting a service, so a short interval keeps an override responsive during an incident
 * at negligible cost.
 *
 * @internal
 */
export const DEFAULT_POLL_INTERVAL_SECONDS = 1;

/**
 * The shortest allowed polling interval, in seconds. A configured interval below it is raised to
 * it. The minimum exists only to prevent a tight loop over the filesystem.
 *
 * @internal
 */
export const MINIMUM_POLL_INTERVAL_SECONDS = 1;

/**
 * The validated configuration of a file-based override source.
 *
 * @internal
 */
export interface FileOverrideSourceConfig {
  /**
   * The files to load, in precedence order.
   */
  paths: string[];
  duplicateKeysHandling: DuplicateKeysHandling;
  changeDetection: FileChangeDetection;
  /**
   * The interval between examinations of the files in polling mode.
   */
  pollIntervalMs: number;
  yamlParser?: YamlParser;
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

/**
 * Formats flag and segment counts, for example "2 flags, 1 segment".
 */
function countsText(flags: number, segments: number): string {
  const parts: string[] = [];
  if (flags > 0) {
    parts.push(pluralize(flags, 'flag'));
  }
  if (segments > 0) {
    parts.push(pluralize(segments, 'segment'));
  }
  return parts.join(', ');
}

/**
 * An override source that reads flag and segment overrides from one or more local files and
 * reloads them as the files change.
 *
 * The files use the same document format as the file data sources: a JSON or YAML document with
 * optional `flags`, `flagValues`, and `segments` members. `flagValues` entries expand into full
 * flag definitions that return the given value for every context. When several files are
 * configured, their entries are combined in the configured order, and the duplicate keys
 * handling decides what happens when the same key appears in more than one file.
 *
 * A reload replaces the entire override set. A configured file that does not exist contributes
 * no overrides, so deleting a file removes its overrides. A file that exists but cannot be read
 * or parsed makes that whole reload fail. The previously loaded overrides stay in effect, the
 * failure is logged, and the source retries after a short delay. Every applied change is logged
 * at Info level with the overrides in effect and what each file supplied.
 *
 * Flag overrides are currently experimental and subject to change.
 *
 * @internal
 */
export default class FileOverrideSource implements LDOverrideSource {
  private _reloader?: FileReloader;

  private _poller?: FilePoller;

  private _watcher?: FileDirectoryWatcher;

  constructor(
    public readonly config: FileOverrideSourceConfig,
    private readonly _filesystem: Filesystem,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Sets up change detection and performs the initial load. The returned promise settles when
   * the initial load has completed. A file that does not exist yet contributes no overrides. A
   * file that cannot be read or parsed is not fatal: the failure is logged, and the retry plus
   * the change signal recover once the file is readable.
   */
  async start(sink: LDOverrideSink): Promise<void> {
    const { paths, duplicateKeysHandling, changeDetection, pollIntervalMs, yamlParser } =
      this.config;
    this._reloader = new FileReloader({
      paths,
      duplicateKeysHandling,
      skipMissingPaths: true,
      filesystem: this._filesystem,
      yamlParser,
      logger: this._logger,
      apply: (result) => {
        sink.setOverrides(result.flags, result.segments);
        this._logOverridesInEffect(result);
      },
      debounceDelayMs: DEFAULT_DEBOUNCE_DELAY_MS,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      skipUnchanged: true,
    });
    const trigger = () => this._reloader?.trigger();

    // Change detection is in place before the initial load, so a change made between the two
    // is not missed. The reloader absorbs the redundant reload this can cause.
    if (changeDetection === 'watching') {
      this._watcher = new FileDirectoryWatcher(this._filesystem, paths, trigger, this._logger);
      this._watcher.start();
    } else {
      this._poller = new FilePoller(this._filesystem, paths, pollIntervalMs, trigger);
      await this._poller.start();
    }

    // A close during the load stops the poller or watcher and closes the reloader, so a load
    // that completes afterward delivers nothing.
    await this._reloader.reloadNow();
  }

  close(): void {
    this._watcher?.close();
    this._poller?.close();
    this._reloader?.close();
  }

  /**
   * Reports the overrides now in effect and what each file supplied. The reloader applies a
   * snapshot only when the content changed, so this logs each change once.
   */
  private _logOverridesInEffect(result: ReloadResult): void {
    const details = result.files.map((file) => {
      if (!file.present) {
        return `${file.path}: absent`;
      }
      if (file.flags === 0 && file.segments === 0) {
        return `${file.path}: no entries`;
      }
      return `${file.path}: ${countsText(file.flags, file.segments)}`;
    });
    if (result.flags.length === 0 && result.segments.length === 0) {
      this._logger?.info(`Flag overrides: none in effect (${details.join('; ')})`);
      return;
    }
    this._logger?.info(
      `Flag overrides in effect: ${countsText(result.flags.length, result.segments.length)} (${details.join('; ')})`,
    );
  }
}
