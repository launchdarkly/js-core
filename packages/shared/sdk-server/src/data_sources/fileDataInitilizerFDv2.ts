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
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';
import {
  FileDataPolicy,
  FileReloader,
  KeyedItem,
  LoadFailure,
  parseDocumentByExtension,
  ReloadResult,
  YamlParser,
} from './filedata';
import { makeFlagWithValue } from './FileDataSource';

/**
 * How the FDv2 file data initializer translates its documents into data. This is the one place
 * where its rules differ from the other file-based sources.
 *
 * - The parser is chosen by file extension only.
 * - A `flagValues` entry becomes a flag that is on and serves the value by fallthrough, with
 *   version 1. The initializer runs once and has no previous load to compare against.
 * - A flag or segment entry is keyed by its map key, as the initializer has always merged it.
 * - The last definition of a key wins, across files and between the `flags` and `flagValues`
 *   members of one file.
 * - A configured file that does not exist fails the load.
 *
 * @internal
 */
export function fileDataInitializerPolicy(yamlParser?: YamlParser): FileDataPolicy {
  return {
    parseDocument: parseDocumentByExtension(yamlParser),
    makeFlagWithValue: (key, value) => makeFlagWithValue(key, value, 1),
    resolveDuplicateKey: () => 'keepLast',
    missingFile: 'fail',
    entryKey: (mapKey) => mapKey,
  };
}

function byKey<T>(items: KeyedItem<T>[]): { [key: string]: T } {
  const result: { [key: string]: T } = {};
  items.forEach(({ key, item }) => {
    result[key] = item;
  });
  return result;
}

/**
 * Loads flag/segment data from one or more files. Each file may contain `flags`
 * (full flag JSON) and/or `segments` keys, and also supports the `flagValues`
 * shorthand map (`{ [key]: value }`) for quickly defining single-variation flags,
 * the same shorthand supported by FDv1's `FileDataSource`.
 *
 * @remarks
 * This initializer runs once at startup and never reloads or diffs against
 * previously loaded data, so every flag generated from `flagValues` gets
 * `version: 1` - there is no version-bump-on-change behavior like FDv1 has.
 * Duplicate keys resolve last-value-wins (across files, and between a `flags`
 * and `flagValues` entry for the same key within one file) rather than being
 * rejected the way FDv1 does.
 *
 * @internal
 */
export default class FileDataInitializerFDv2 implements subsystemCommon.DataSource {
  private _paths: Array<string>;
  private _logger: LDLogger | undefined;
  private _filesystem: Filesystem;
  private _yamlParser?: (data: string) => any;
  private _reloader?: FileReloader;

  constructor(options: FileSystemDataSourceConfiguration, platform: Platform, logger?: LDLogger) {
    this._validateInputs(options, platform);

    this._paths = options.paths;
    this._logger = logger;
    this._filesystem = platform.fileSystem!;
    this._yamlParser = options.yamlParser;
  }

  private _validateInputs(options: FileSystemDataSourceConfiguration, platform: Platform) {
    if (!options.paths || options.paths.length === 0) {
      throw new Error('FileDataInitializerFDv2: paths are required');
    }

    if (!platform.fileSystem) {
      throw new Error('FileDataInitializerFDv2: file system is required');
    }
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    statusCallback(subsystemCommon.DataSourceState.Initializing);
    const initMetadata = internal.initMetadataFromHeaders(undefined);

    const payloadProcessor = new internal.PayloadProcessor(
      {
        flag: (flag: Flag) => {
          processFlag(flag);
          return flag;
        },
        segment: (segment: Segment) => {
          processSegment(segment);
          return segment;
        },
      },
      (errorKind: DataSourceErrorKind, message: string) => {
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(errorKind, message),
        );
      },
      this._logger,
    );

    const adaptor = internal.FDv1PayloadAdaptor(payloadProcessor);

    const apply = (result: ReloadResult) => {
      payloadProcessor.addPayloadListener((payload) => {
        // NOTE: file data initializer will never have a valid basis, so we always pass false
        dataCallback(false, { initMetadata, payload });
      });

      statusCallback(subsystemCommon.DataSourceState.Valid);

      adaptor.processFullTransfer({
        segments: byKey(result.segments),
        flags: byKey(result.flags),
      });

      statusCallback(subsystemCommon.DataSourceState.Closed);
    };

    const onFailure = (failure: LoadFailure) => {
      if (failure.kind === 'read') {
        this._logger?.error('Error loading files', failure.error);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(
            DataSourceErrorKind.NetworkError,
            `Failed to load files: ${failure.error.message}`,
          ),
        );
        return;
      }
      this._logger?.error('File contained invalid data', failure.error);
      statusCallback(
        subsystemCommon.DataSourceState.Closed,
        new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in file response'),
      );
    };

    // The initializer loads once. It does not watch, debounce, or retry.
    this._reloader = new FileReloader({
      paths: this._paths,
      policy: fileDataInitializerPolicy(this._yamlParser),
      filesystem: this._filesystem,
      logger: this._logger,
      apply,
      onFailure,
      debounceDelayMs: 0,
      retryDelayMs: 0,
      skipUnchanged: false,
    });
    this._reloader.reloadNow();
  }

  stop() {
    this._reloader?.close();
  }
}
