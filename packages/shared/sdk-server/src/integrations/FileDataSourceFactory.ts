import { LDClientContext, LDLogger, subsystem, VoidFunction } from '@launchdarkly/js-sdk-common';

import { FileDataSourceOptions } from '../api/integrations';
import { LDFeatureStore } from '../api/subsystems';
import FileDataSource, { FileDataSourceErrorHandler } from '../data_sources/FileDataSource';

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
  constructor(private readonly _options: FileDataSourceOptions) {}

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
  create(
    ldClientContext: LDClientContext,
    featureStore: LDFeatureStore,
    initSuccessHandler?: VoidFunction,
    errorHandler?: FileDataSourceErrorHandler,
  ) {
    const updatedOptions: FileDataSourceOptions = {
      paths: this._options.paths,
      autoUpdate: this._options.autoUpdate,
      logger: this._options.logger || ldClientContext.basicConfiguration.logger,
      yamlParser: this._options.yamlParser,
    };
    return new FileDataSource(
      updatedOptions,
      ldClientContext.platform.fileSystem!,
      featureStore,
      initSuccessHandler,
      errorHandler,
    );
  }

  getFactory(): (
    ldClientContext: LDClientContext,
    featureStore: LDFeatureStore,
    initSuccessHandler?: VoidFunction,
    errorHandler?: FileDataSourceErrorHandler,
  ) => subsystem.LDStreamProcessor {
    return (ldClientContext, featureStore, initSuccessHandler, errorHandler) =>
      this.create(ldClientContext, featureStore, initSuccessHandler, errorHandler);
  }
}
