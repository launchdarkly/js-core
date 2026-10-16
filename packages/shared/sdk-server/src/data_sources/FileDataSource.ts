import {
  Filesystem,
  LDFileDataSourceError,
  LDLogger,
  subsystem,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { DataKind, LDFeatureStoreDataStorage } from '../api';
import { FileDataSourceOptions } from '../api/integrations';
import { LDDataSourceUpdates } from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import { processFlag, processSegment } from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';
import {
  DEFAULT_DEBOUNCE_DELAY_MS,
  DEFAULT_RETRY_DELAY_MS,
  FileDataPolicy,
  FileDirectoryWatcher,
  FileReloader,
  LoadFailure,
  parseDocumentByExtension,
  ReloadResult,
  YamlParser,
} from './filedata';

export type FileDataSourceErrorHandler = (err: LDFileDataSourceError) => void;

export function makeFlagWithValue(key: string, value: any, version: number): Flag {
  return {
    key,
    on: true,
    fallthrough: { variation: 0 },
    variations: [value],
    version,
  };
}

/**
 * How the file data source translates its documents into data. This is the one place where its
 * rules differ from the other file-based sources.
 *
 * - The parser is chosen by file extension only.
 * - A `flagValues` entry becomes a flag that is on and serves the value by fallthrough. Its
 *   version starts at 1 and increments only when the value changes between loads.
 * - A flag or segment entry is keyed by its own `key` property, as the source has always stored
 *   it, so two entries with the same `key` property are duplicates whatever their map keys.
 * - A key that appears more than once fails the load.
 * - A configured file that does not exist fails the load.
 *
 * @internal
 */
export function fileDataSourcePolicy(yamlParser?: YamlParser): FileDataPolicy {
  return {
    parseDocument: parseDocumentByExtension(yamlParser),
    makeFlagWithValue: (key, value, previous) => {
      let version = previous ? previous.version : 1;
      if (previous && JSON.stringify(value) !== JSON.stringify(previous.variations?.[0])) {
        version += 1;
      }
      return makeFlagWithValue(key, value, version);
    },
    resolveDuplicateKey: (_category, key) => {
      throw new Error(`found duplicate key: "${key}"`);
    },
    missingFile: 'fail',
    entryKey: (_mapKey, entry) => String(entry.key),
  };
}

export default class FileDataSource implements subsystem.LDStreamProcessor {
  private _logger?: LDLogger;

  private _reloader: FileReloader;

  private _watcher?: FileDirectoryWatcher;

  /**
   * This is internal because we want instances to only be created with the
   * factory.
   * @internal
   */
  constructor(
    options: FileDataSourceOptions,
    filesystem: Filesystem,
    private readonly _featureStore: LDDataSourceUpdates,
    private _initSuccessHandler: VoidFunction = () => {},
    private readonly _errorHandler?: FileDataSourceErrorHandler,
  ) {
    this._logger = options.logger;
    const autoUpdate = options.autoUpdate ?? false;
    this._reloader = new FileReloader({
      paths: options.paths,
      policy: fileDataSourcePolicy(options.yamlParser),
      filesystem,
      logger: options.logger,
      apply: (result) => this._applyData(result),
      onFailure: (failure) => this._handleFailure(failure),
      // Debouncing and automatic retries only matter when something can trigger further
      // reloads. A source configured without automatic updates loads exactly once.
      debounceDelayMs: autoUpdate ? DEFAULT_DEBOUNCE_DELAY_MS : 0,
      retryDelayMs: autoUpdate ? DEFAULT_RETRY_DELAY_MS : 0,
      skipUnchanged: true,
    });
    if (autoUpdate) {
      // The directories that contain the files are watched, so a file replaced by a rename or
      // deleted and recreated is detected, and a file that is missing is picked up when it appears.
      this._watcher = new FileDirectoryWatcher(
        filesystem,
        options.paths,
        () => this._reloader.trigger(),
        options.logger,
      );
    }
  }

  start(): void {
    // The watch is in place before the first load, so a change made between the two is not
    // missed. The load never rejects: every filesystem and parsing failure is reported through
    // the error handler.
    this._watcher?.start();
    this._reloader.reloadNow();
  }

  stop(): void {
    this._watcher?.close();
    this._reloader.close();
  }

  close(): void {
    this.stop();
  }

  private _applyData(result: ReloadResult): void {
    const allData: LDFeatureStoreDataStorage = {};
    const addItem = (kind: DataKind, item: any) => {
      if (!allData[kind.namespace]) {
        allData[kind.namespace] = {};
      }
      allData[kind.namespace][item.key] = item;
    };
    result.flags.forEach(({ item }) => {
      processFlag(item);
      addItem(VersionedDataKinds.Features, item);
    });
    result.segments.forEach(({ item }) => {
      processSegment(item);
      addItem(VersionedDataKinds.Segments, item);
    });

    this._featureStore.init(allData, () => {
      // Call the init callback if present.
      // Then clear the callback so we cannot call it again.
      this._initSuccessHandler();
      this._initSuccessHandler = () => {};
    });
  }

  private _handleFailure(failure: LoadFailure): void {
    // A load that fails to read a file can mean that the file's directory is gone, and a watch on
    // a deleted directory cannot report anything useful. Let the watcher check its directories.
    this._watcher?.verify();
    const message =
      failure.kind === 'read'
        ? `Error loading files: ${failure.error}`
        : `Error processing files: ${failure.error}`;
    if (failure.repeated) {
      // An automatic retry hit the same failure again. Report it once at error level.
      this._logger?.debug(message);
      return;
    }
    this._errorHandler?.(failure.error as LDFileDataSourceError);
    this._logger?.error(message);
  }
}
