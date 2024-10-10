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
import FileLoader from './FileLoader';

export type FileDataSourceErrorHandler = (err: LDFileDataSourceError) => void;

function makeFlagWithValue(key: string, value: any, version: number): Flag {
  return {
    key,
    on: true,
    fallthrough: { variation: 0 },
    variations: [value],
    version,
  };
}

export default class FileDataSource implements subsystem.LDStreamProcessor {
  private _logger?: LDLogger;

  private _yamlParser?: (data: string) => any;

  private _fileLoader: FileLoader;

  private _allData: LDFeatureStoreDataStorage = {};

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
    this._fileLoader = new FileLoader(
      filesystem,
      options.paths,
      options.autoUpdate ?? false,
      (results: { path: string; data: string }[]) => {
        // Whenever changes are detected we re-process all of the data.
        // The FileLoader will have handled debouncing for us.
        try {
          this._processFileData(results);
        } catch (err) {
          // If this was during start, then the initCallback will be present.
          this._errorHandler?.(err as LDFileDataSourceError);
          this._logger?.error(`Error processing files: ${err}`);
        }
      },
    );

    this._logger = options.logger;
    this._yamlParser = options.yamlParser;
  }

  start(): void {
    // Use an immediately invoked function expression to allow handling of the
    // async loading without making start async itself.
    (async () => {
      try {
        await this._fileLoader.loadAndWatch();
      } catch (err) {
        // There was an issue loading/watching the files.
        // Report back to the caller.
        this._errorHandler?.(err as LDFileDataSourceError);
      }
    })();
  }

  stop(): void {
    this._fileLoader.close();
  }

  close(): void {
    this.stop();
  }

  private _addItem(kind: DataKind, item: any) {
    if (!this._allData[kind.namespace]) {
      this._allData[kind.namespace] = {};
    }
    if (this._allData[kind.namespace][item.key]) {
      throw new Error(`found duplicate key: "${item.key}"`);
    } else {
      this._allData[kind.namespace][item.key] = item;
    }
  }

  private _processFileData(fileData: { path: string; data: string }[]) {
    // Clear any existing data before re-populating it.
    const oldData = this._allData;
    this._allData = {};

    // We let the parsers throw, and the caller can handle the rejection.
    fileData.forEach((fd) => {
      let parsed: any;
      if (fd.path.endsWith('.yml') || fd.path.endsWith('.yaml')) {
        if (this._yamlParser) {
          parsed = this._yamlParser(fd.data);
        } else {
          throw new Error(`Attempted to parse yaml file (${fd.path}) without parser.`);
        }
      } else {
        parsed = JSON.parse(fd.data);
      }

      this._processParsedData(parsed, oldData);
    });

    this._featureStore.init(this._allData, () => {
      // Call the init callback if present.
      // Then clear the callback so we cannot call it again.
      this._initSuccessHandler();
      this._initSuccessHandler = () => {};
    });
  }

  private _processParsedData(parsed: any, oldData: LDFeatureStoreDataStorage) {
    Object.keys(parsed.flags || {}).forEach((key) => {
      processFlag(parsed.flags[key]);
      this._addItem(VersionedDataKinds.Features, parsed.flags[key]);
    });
    Object.keys(parsed.flagValues || {}).forEach((key) => {
      const previousInstance = oldData[VersionedDataKinds.Features.namespace]?.[key];
      let { version } = previousInstance ?? { version: 1 };
      // If the data is different, then we want to increment the version.
      if (
        previousInstance &&
        JSON.stringify(parsed.flagValues[key]) !== JSON.stringify(previousInstance?.variations?.[0])
      ) {
        version += 1;
      }
      const flag = makeFlagWithValue(key, parsed.flagValues[key], version);
      processFlag(flag);
      this._addItem(VersionedDataKinds.Features, flag);
    });
    Object.keys(parsed.segments || {}).forEach((key) => {
      processSegment(parsed.segments[key]);
      this._addItem(VersionedDataKinds.Segments, parsed.segments[key]);
    });
  }
}
