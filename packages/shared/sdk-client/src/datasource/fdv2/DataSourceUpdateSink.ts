import { Context, LDLogger } from '@launchdarkly/js-sdk-common';

import { FlagManager } from '../../flag-manager/FlagManager';
import { flagEvalPayloadToItemDescriptors } from '../flagEvalMapper';
import { ChangeSetResult } from './FDv2SourceResult';

/**
 * Configuration for creating a {@link DataSourceUpdateSink}.
 */
export interface DataSourceUpdateSinkConfig {
  /** FlagManager to apply flag updates to. */
  flagManager: FlagManager;

  /**
   * Getter for the current evaluation context. A getter is used instead of a
   * stored context because the context changes on `identify()`.
   */
  contextGetter: () => Context;

  /** Optional logger. */
  logger?: LDLogger;
}

/**
 * Thin adapter between the FDv2 protocol layer and {@link FlagManager}.
 * Converts FDv2 protocol types (payload updates) to {@link ItemDescriptor}
 * format and delegates to {@link FlagManager.applyChanges}.
 *
 * Selector and environmentId are managed by FlagManager, not the sink.
 */
export interface DataSourceUpdateSink {
  /**
   * Processes a {@link ChangeSetResult} and applies flag updates to
   * FlagManager. Pass this as the `dataCallback` to {@link FDv2DataSource}.
   */
  handleChangeSet(result: ChangeSetResult): void;
}

/**
 * Creates a {@link DataSourceUpdateSink}.
 */
export function createDataSourceUpdateSink(
  config: DataSourceUpdateSinkConfig,
): DataSourceUpdateSink {
  const { flagManager, contextGetter, logger } = config;

  return {
    handleChangeSet(result: ChangeSetResult): void {
      const { payload } = result;
      const context = contextGetter();
      const selector = payload.state || undefined;
      const { environmentId } = result;

      if (payload.type === 'none') {
        logger?.debug('FDv2 payload type "none": no flag updates needed');
        flagManager.applyChanges(context, {}, false, selector, environmentId);
        return;
      }

      const descriptors = flagEvalPayloadToItemDescriptors(payload.updates);
      const basis = payload.type === 'full';

      logger?.debug(
        `FDv2 ${payload.type} payload: ${basis ? 'initializing' : 'upserting'} ${Object.keys(descriptors).length} flags`,
      );

      flagManager.applyChanges(context, descriptors, basis, selector, environmentId);
    },
  };
}
