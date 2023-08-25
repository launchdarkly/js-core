import { LDClientContext, LDLogger, subsystem } from '@launchdarkly/js-sdk-common';

import { FileDataSourceOptions } from '../api/integrations';
import { LDFeatureStore } from '../api/subsystems';
import FileDataSource from '../data_sources/FileDataSource';

/**
 * Components of the SDK runtime configuration which are required
 * by the FileDataSource.
 */
export interface FileDataSourceFactoryConfig {
  featureStore: LDFeatureStore;
  logger?: LDLogger;
}

/**
 * Class for creating file data sources.
 */

export default class FileDataSourceFactory {
  constructor(private readonly options: FileDataSourceOptions) {}

  /**
   * Method for creating instances of the file data source. This method is intended to be used
   * by the SDK.
   *
   * @param config SDK configuration required by the file data source.
   * @param filesystem Platform abstraction used for filesystem access.
   * @returns a {@link FileDataSource}
   *
   * @internal
   */
  create(ldClientContext: LDClientContext, featureStore: LDFeatureStore) {
    const updatedOptions: FileDataSourceOptions = {
      paths: this.options.paths,
      autoUpdate: this.options.autoUpdate,
      logger: this.options.logger || ldClientContext.basicConfiguration.logger,
      yamlParser: this.options.yamlParser,
    };
    return new FileDataSource(updatedOptions, ldClientContext.platform.fileSystem!, featureStore);
  }

  getFactory(): (
    ldClientContext: LDClientContext,
    featureStore: LDFeatureStore,
  ) => subsystem.LDStreamProcessor {
    return (ldClientContext, featureStore) => this.create(ldClientContext, featureStore);
  }
}
