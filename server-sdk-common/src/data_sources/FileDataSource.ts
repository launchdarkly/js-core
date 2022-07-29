import { LDLogger } from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '../api';
import { FileDataSourceOptions } from '../api/integrations';
import { DataKind } from '../api/interfaces';
import { LDFeatureStore, LDFeatureStoreDataStorage } from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import Configuration from '../options/Configuration';
import { Filesystem } from '../platform';
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

class FileDataSource implements LDStreamProcessor {
  private logger?: LDLogger;

  private yamlParser?: (data: string) => any;

  private fileLoader: FileLoader;

  private allData: LDFeatureStoreDataStorage = {};

  private initCallback?: ((err?: any) => void);

  /**
   * This is internal because we want instances to only be created with the
   * factory method.
   * @internal
   */
  constructor(
    options: FileDataSourceOptions,
    filesystem: Filesystem,
    private readonly featureStore: LDFeatureStore,
  ) {
    this.fileLoader = new FileLoader(
      filesystem,
      options.paths,
      options.autoUpdate ?? false,
      (results: { path: string, data: string }[]) => {
        // Whenever changes are detected we re-process all of the data.
        // The FileLoader will have handled debouncing for us.
        this.processFileData(results);
      },
    );

    this.logger = options.logger;
    this.yamlParser = options.yamlParser;
  }

  start(fn?: ((err?: any) => void) | undefined): void {
    this.initCallback = fn;
    this.fileLoader.loadAndWatch();
  }

  stop(): void {
    this.fileLoader.close();
  }

  close(): void {
    this.stop();
  }

  private tryParse(parser: (data: string) => any, path: string, data: string): any {
    try {
      return parser(data);
    } catch (err) {
      this.logger?.error(`Error parsing file ${path}. ${err}`);
      return undefined;
    }
  }

  private addItem(kind: DataKind, item: any) {
    if (!this.allData[kind.namespace]) {
      this.allData[kind.namespace] = {};
    }
    if (this.allData[kind.namespace][item.key]) {
      this.logger?.error(`found duplicate key: "${item.key}"`);
    } else {
      this.allData[kind.namespace][item.key] = item;
    }
  }

  private processFileData(fileData: { path: string, data: string }[]) {
    // Clear any existing data before re-populating it.
    this.allData = {};

    fileData.forEach((fd) => {
      let parsed: any;
      if (fd.path.endsWith('.yml') || fd.path.endsWith('.yaml')) {
        if (this.yamlParser) {
          parsed = this.tryParse(this.yamlParser, fd.path, fd.data);
        } else {
          this.logger?.error('Attempted to parse yaml file without parser.');
        }
      } else {
        parsed = this.tryParse(JSON.parse, fd.path, fd.data);
      }

      if (parsed) {
        this.processParsedData(parsed);
      }
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

/**
 * Creates a factory which will create {@link FileDataSource} instances
 * based on the SDK configuration.
 */
export default function factory(options: FileDataSourceOptions):
(config: Configuration, filesystem: Filesystem, featureStore: LDFeatureStore) => FileDataSource {
  return (config: Configuration, filesystem: Filesystem) => {
    const updatedOptions: FileDataSourceOptions = {
      paths: options.paths,
      autoUpdate: options.autoUpdate,
      logger: options.logger || config.logger,
    };
    return new FileDataSource(updatedOptions, filesystem, config.featureStore);
  };
}
