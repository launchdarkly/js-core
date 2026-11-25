import {
  DataSourceErrorKind,
  Filesystem,
  internal,
  LDLogger,
  LDPollingError,
  Platform,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { FileSystemDataSourceConfiguration } from '../api';
import { Flag } from '../evaluation/data/Flag';
import {
  DEFAULT_DEBOUNCE_DELAY_MS,
  DEFAULT_RETRY_DELAY_MS,
  FileDirectoryWatcher,
  FileReloader,
  KeyedItem,
  LoadFailure,
  ReloadResult,
  YamlParser,
} from './filedata';
import { makeFullPayloadSender } from './fileDataPayloadFDv2';
import { fileDataSourcePolicy } from './FileDataSource';

/**
 * The flags of the last good load, shared by the synchronizers that one configuration entry
 * creates. The data system can replace a synchronizer with a new one. A new synchronizer
 * continues the flag versions from the shared flags, so that a changed value gets a higher
 * version and the store applies it.
 *
 * @internal
 */
export interface SharedFileFlags {
  flags?: Record<string, Flag>;
  /**
   * Whether each path contributed content to the data in effect. A new synchronizer that finds
   * such a file empty holds it back as an in-place rewrite, instead of reporting a failure.
   */
  appliedHadContent?: Map<string, boolean>;
  /**
   * The number of the last good load. A flag or segment entry without a version gets this number
   * as its version.
   */
  loadNumber?: number;
}

/**
 * Gives each item without a version the given version. The store skips an item of a full payload
 * that has the same version as the stored item. An entry without a version has no version to
 * compare, so each load counts it as changed, as the FDv1 file data source does.
 */
function withLoadVersion<T extends { version: number }>(
  items: KeyedItem<T>[],
  version: number,
): KeyedItem<T>[] {
  return items.map(({ key, item }) =>
    // An entry that is not an object goes to the payload processing unchanged, which fails the load.
    item !== null && typeof item === 'object' && item.version === undefined
      ? { key, item: { ...item, version } }
      : { key, item },
  );
}

function loadFailureError(failure: LoadFailure): LDPollingError {
  if (failure.kind === 'read') {
    return new LDPollingError(
      DataSourceErrorKind.NetworkError,
      `Failed to load files: ${failure.error.message}`,
    );
  }
  return new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in file response');
}

/**
 * An FDv2 synchronizer that loads flag and segment data from local files. It translates the
 * files with the same rules as the FDv1 file data source.
 *
 * Each successful load sends a full payload and then reports the state Valid. When `autoUpdate`
 * is true, the synchronizer watches the files and loads them again when they change.
 *
 * When the first load fails and `autoUpdate` is true, the synchronizer reports the state
 * Interrupted without an error. Its watcher and automatic retry load the files when they become
 * good, and an error state makes the data system replace the synchronizer. When `autoUpdate` is
 * false, the synchronizer reports the state Interrupted with an error, so that the data system
 * can try again. A load that fails after a successful load keeps the last good data. The
 * synchronizer logs the failure and reports no state.
 *
 * @internal
 */
export default class FileDataSynchronizerFDv2 implements subsystemCommon.DataSource {
  private readonly _paths: Array<string>;

  private readonly _filesystem: Filesystem;

  private readonly _yamlParser?: YamlParser;

  private readonly _autoUpdate: boolean;

  private _reloader?: FileReloader;

  private _watcher?: FileDirectoryWatcher;

  constructor(
    options: FileSystemDataSourceConfiguration,
    platform: Platform,
    private readonly _logger?: LDLogger,
    private readonly _sharedFlags: SharedFileFlags = {},
  ) {
    if (!options.paths || options.paths.length === 0) {
      throw new Error('FileDataSynchronizerFDv2: paths are required');
    }
    if (!platform.fileSystem) {
      throw new Error('FileDataSynchronizerFDv2: file system is required');
    }
    this._paths = options.paths;
    this._filesystem = platform.fileSystem;
    this._yamlParser = options.yamlParser;
    this._autoUpdate = options.autoUpdate ?? false;
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ): void {
    if (this._reloader) {
      return;
    }
    if (!this._sharedFlags.appliedHadContent) {
      this._sharedFlags.appliedHadContent = new Map();
    }
    const initMetadata = internal.initMetadataFromHeaders(undefined);
    let loaded = false;

    // A full payload without a selector is not a basis, so the synchronizer passes false.
    const sendFullPayload = makeFullPayloadSender(
      (payload) => dataCallback(false, { initMetadata, payload }),
      (errorKind: DataSourceErrorKind, message: string) => {
        // An error in the payload fails the load. The reloader then keeps the last good data and
        // reports the failure.
        throw new LDPollingError(errorKind, message);
      },
      this._logger,
    );

    const apply = (result: ReloadResult) => {
      const loadNumber = (this._sharedFlags.loadNumber ?? 0) + 1;
      const versionedFlags = withLoadVersion(result.flags, loadNumber);
      sendFullPayload({
        ...result,
        flags: versionedFlags,
        segments: withLoadVersion(result.segments, loadNumber),
      });
      // A null-prototype object, so that a flag key such as constructor is an ordinary key.
      const flags: Record<string, Flag> = Object.create(null);
      versionedFlags.forEach(({ key, item }) => {
        flags[key] = item;
      });
      this._sharedFlags.flags = flags;
      this._sharedFlags.loadNumber = loadNumber;
      loaded = true;
      statusCallback(subsystemCommon.DataSourceState.Valid);
    };

    const onFailure = (failure: LoadFailure) => {
      // A load that fails to read a file can mean that the directory of the file is gone. Let the
      // watcher check its directories.
      this._watcher?.verify();
      const message =
        failure.kind === 'read'
          ? `Error loading files: ${failure.error}`
          : `Error processing files: ${failure.error}`;
      if (failure.repeated) {
        // An automatic retry finds the same failure again. Only the first report is at error level.
        this._logger?.debug(message);
      } else {
        this._logger?.error(message);
      }
      if (loaded) {
        return;
      }
      if (this._autoUpdate) {
        // The watcher and the automatic retry load the files when they become good. An error
        // state makes the data system replace the synchronizer, which closes them.
        statusCallback(subsystemCommon.DataSourceState.Interrupted);
      } else {
        // Nothing else loads the files again. The error lets the data system try again.
        statusCallback(subsystemCommon.DataSourceState.Interrupted, loadFailureError(failure));
      }
    };

    this._reloader = new FileReloader({
      paths: this._paths,
      policy: fileDataSourcePolicy(this._yamlParser),
      filesystem: this._filesystem,
      logger: this._logger,
      apply,
      onFailure,
      // Debouncing and automatic retries only matter when a change can start another load. A
      // synchronizer without automatic updates loads one time.
      debounceDelayMs: this._autoUpdate ? DEFAULT_DEBOUNCE_DELAY_MS : 0,
      retryDelayMs: this._autoUpdate ? DEFAULT_RETRY_DELAY_MS : 0,
      skipUnchanged: true,
      initialFlags: this._sharedFlags.flags,
      appliedHadContent: this._sharedFlags.appliedHadContent,
    });
    if (this._autoUpdate) {
      const reloader = this._reloader;
      this._watcher = new FileDirectoryWatcher(
        this._filesystem,
        this._paths,
        () => reloader.trigger(),
        this._logger,
      );
      // The watch is in place before the first load, so that a change between the two is not
      // missed.
      this._watcher.start();
    }
    this._reloader.reloadNow();
  }

  stop(): void {
    this._watcher?.close();
    this._reloader?.close();
  }
}
