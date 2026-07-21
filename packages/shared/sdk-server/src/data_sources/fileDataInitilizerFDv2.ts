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
import FileLoader from './FileLoader';
import { makeFlagWithValue } from './FileDataSource';

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
  private _fileLoader?: FileLoader;

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

    this._fileLoader = new FileLoader(
      this._filesystem,
      this._paths,
      false, // autoupdate is always false for initializer
      (results: { path: string; data: string }[]) => {
        try {
          const parsedData = this._processFileData(results);

          payloadProcessor.addPayloadListener((payload) => {
            // NOTE: file data initializer will never have a valid basis, so we always pass false
            dataCallback(false, { initMetadata, payload });
          });

          statusCallback(subsystemCommon.DataSourceState.Valid);

          adaptor.processFullTransfer(parsedData);

          statusCallback(subsystemCommon.DataSourceState.Closed);
        } catch (err) {
          this._logger?.error('File contained invalid data', err);
          statusCallback(
            subsystemCommon.DataSourceState.Closed,
            new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in file response'),
          );
        }
      },
    );

    this._fileLoader.loadAndWatch().catch((err) => {
      this._logger?.error('Error loading files', err);
      statusCallback(
        subsystemCommon.DataSourceState.Closed,
        new LDPollingError(
          DataSourceErrorKind.NetworkError,
          `Failed to load files: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    });
  }

  private _processFileData(results: { path: string; data: string }[]) {
    const combined: any = results.reduce(
      (acc, curr) => {
        let parsed: any;
        if (curr.path.endsWith('.yml') || curr.path.endsWith('.yaml')) {
          if (this._yamlParser) {
            parsed = this._yamlParser(curr.data);
          } else {
            throw new Error(`Attempted to parse yaml file (${curr.path}) without parser.`);
          }
        } else {
          parsed = JSON.parse(curr.data);
        }

        // flagValues has no previous-state to diff against, so each entry always
        // gets version 1. Convert to full Flag objects here so they merge with
        // flags below on equal footing
        const flagsFromValues: { [key: string]: Flag } = {};
        Object.entries(parsed.flagValues ?? {}).forEach(([key, value]) => {
          flagsFromValues[key] = makeFlagWithValue(key, value, 1);
        });

        return {
          segments: {
            ...acc.segments,
            ...(parsed.segments ?? {}),
          },
          flags: {
            ...acc.flags,
            ...(parsed.flags ?? {}),
            ...flagsFromValues,
          },
        };
      },
      {
        segments: {},
        flags: {},
      },
    );

    return combined;
  }

  stop() {
    if (this._fileLoader) {
      this._fileLoader.close();
    }
  }
}
