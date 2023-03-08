import { LDLogger, Filesystem } from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '../api';
import { FileDataSourceOptions } from '../api/integrations';
import { DataKind } from '../api/interfaces';
import { LDFeatureStore, LDFeatureStoreDataStorage } from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import { processFlag, processSegment } from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';
import FileLoader from './FileLoader';

function makeFlagWithValue(key: string, value: any): Flag {
  return {
    key,
    on: true,
    fallthrough: { variation: 0 },
    variations: [value],
    version: 1,
  };
}

export default class FileDataSource implements LDStreamProcessor {
  private logger?: LDLogger;

  private yamlParser?: (data: string) => any;

  private fileLoader: FileLoader;

  private allData: LDFeatureStoreDataStorage = {};

  private initCallback?: (err?: any) => void;

  /**
   * This is internal because we want instances to only be created with the
   * factory.
   * @internal
   */
  constructor(
    options: FileDataSourceOptions,
    filesystem: Filesystem,
    private readonly featureStore: LDFeatureStore
  ) {
    this.fileLoader = new FileLoader(
      filesystem,
      options.paths,
      options.autoUpdate ?? false,
      (results: { path: string; data: string }[]) => {
        // Whenever changes are detected we re-process all of the data.
        // The FileLoader will have handled debouncing for us.
        try {
          this.processFileData(results);
        } catch (err) {
          // If this was during start, then the initCallback will be present.
          this.initCallback?.(err);
          this.logger?.error(`Error processing files: ${err}`);
        }
      }
    );

    this.logger = options.logger;
    this.yamlParser = options.yamlParser;
  }

  start(fn?: ((err?: any) => void) | undefined): void {
    this.initCallback = fn;
    // Use an immediately invoked function expression to allow handling of the
    // async loading without making start async itself.
    (async () => {
      try {
        await this.fileLoader.loadAndWatch();
      } catch (err) {
        // There was an issue loading/watching the files.
        // Report back to the caller.
        fn?.(err);
      }
    })();
  }

  stop(): void {
    this.fileLoader.close();
  }

  close(): void {
    this.stop();
  }

  private addItem(kind: DataKind, item: any) {
    if (!this.allData[kind.namespace]) {
      this.allData[kind.namespace] = {};
    }
    if (this.allData[kind.namespace][item.key]) {
      throw new Error(`found duplicate key: "${item.key}"`);
    } else {
      this.allData[kind.namespace][item.key] = item;
    }
  }

  private processFileData(fileData: { path: string; data: string }[]) {
    // Clear any existing data before re-populating it.
    this.allData = {};

    // We let the parsers throw, and the caller can handle the rejection.
    fileData.forEach((fd) => {
      let parsed: any;
      if (fd.path.endsWith('.yml') || fd.path.endsWith('.yaml')) {
        if (this.yamlParser) {
          parsed = this.yamlParser(fd.data);
        } else {
          throw new Error(`Attempted to parse yaml file (${fd.path}) without parser.`);
        }
      } else {
        parsed = JSON.parse(fd.data);
      }

      this.processParsedData(parsed);
    });

    this.featureStore.init(this.allData, () => {
      // Call the init callback if present.
      // Then clear the callback so we cannot call it again.
      this.initCallback?.();
      this.initCallback = undefined;
    });
  }

  private processParsedData(parsed: any) {
    Object.keys(parsed.flags || {}).forEach((key) => {
      processFlag(parsed.flags[key]);
      this.addItem(VersionedDataKinds.Features, parsed.flags[key]);
    });
    Object.keys(parsed.flagValues || {}).forEach((key) => {
      const flag = makeFlagWithValue(key, parsed.flagValues[key]);
      processFlag(flag);
      this.addItem(VersionedDataKinds.Features, flag);
    });
    Object.keys(parsed.segments || {}).forEach((key) => {
      processSegment(parsed.segments[key]);
      this.addItem(VersionedDataKinds.Segments, parsed.segments[key]);
    });
  }
}
