import { LDLogger } from '@launchdarkly/js-sdk-common';
import { FileDataSourceOptions } from '../api/integrations';
import { LDFeatureStore } from '../api/subsystems';
import { Filesystem } from '../platform';
import FileDataSource from './FileDataSource';

/**
 * Components of the SDK runtime configuration which are required
 * by the FileDataSource.
 */
export interface FileDataSourceFactoryConfig {
  featureStore: LDFeatureStore,
  logger?: LDLogger
}

/**
 * Class for creating file data sources.
 */

export default class FileDataSourceFactory {
  constructor(private readonly options: FileDataSourceOptions) { }

  /**
   * Method for creating instances of the file data source. This method is intended to be used
   * by the SDK.
   *
   * @param config SDK configuration required by the file data source.
   * @param filesystem Platform abstraction used for filesystem access.
   * @returns a {@link FileDataSource}
   */
  create(
    config: FileDataSourceFactoryConfig,
    filesystem: Filesystem,
  ) {
    const updatedOptions: FileDataSourceOptions = {
      paths: this.options.paths,
      autoUpdate: this.options.autoUpdate,
      logger: this.options.logger || config.logger,
      yamlParser: this.options.yamlParser,
    };
    return new FileDataSource(updatedOptions, filesystem, config.featureStore);
  }
}
