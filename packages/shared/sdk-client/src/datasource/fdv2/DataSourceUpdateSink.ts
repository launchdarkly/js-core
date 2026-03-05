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
 * Processes FDv2 {@link ChangeSetResult} payloads and applies them to
 * {@link FlagManager}. Manages the selector (basis state) for delta sync
 * and tracks the environmentId from response headers.
 *
 * This is the client-side equivalent of the server SDK's payload listener,
 * adapted for the Initializer/Synchronizer/FDv2DataSource architecture.
 */
export interface DataSourceUpdateSink {
  /**
   * Processes a {@link ChangeSetResult} and applies flag updates to
   * FlagManager. Pass this as the `dataCallback` to {@link FDv2DataSource}.
   */
  handleChangeSet(result: ChangeSetResult): void;

  /**
   * Returns the current selector string for use as the `basis` query
   * parameter. Returns undefined if no selector has been received yet.
   * Pass this as the `selectorGetter` to {@link FDv2DataSource}.
   *
   * The selector is stored in memory only and is NOT persisted with cache
   * (Requirement 6.2.1).
   */
  getSelector(): string | undefined;

  /**
   * Returns the environment ID from the most recent response headers.
   */
  getEnvironmentId(): string | undefined;
}

/**
 * Creates a {@link DataSourceUpdateSink}.
 */
export function createDataSourceUpdateSink(
  config: DataSourceUpdateSinkConfig,
): DataSourceUpdateSink {
  const { flagManager, contextGetter, logger } = config;

  let selector: string | undefined;
  let environmentId: string | undefined;

  return {
    handleChangeSet(result: ChangeSetResult): void {
      const { payload } = result;

      // Update selector if present in payload (Requirement 6.2.1: in-memory only).
      if (payload.state) {
        selector = payload.state;
      }

      // Track environmentId from response headers (Requirement 4.2.1).
      if (result.environmentId) {
        environmentId = result.environmentId;
      }

      const context = contextGetter();

      switch (payload.type) {
        case 'full': {
          const descriptors = flagEvalPayloadToItemDescriptors(payload.updates);
          logger?.debug(`FDv2 full payload: initializing ${Object.keys(descriptors).length} flags`);
          flagManager.init(context, descriptors);
          break;
        }
        case 'partial': {
          const descriptors = flagEvalPayloadToItemDescriptors(payload.updates);
          logger?.debug(`FDv2 partial payload: upserting ${Object.keys(descriptors).length} flags`);
          Object.entries(descriptors).forEach(([key, descriptor]) => {
            flagManager.upsert(context, key, descriptor);
          });
          break;
        }
        case 'none':
          logger?.debug('FDv2 payload type "none": no flag updates needed');
          break;
        default:
          logger?.warn(`Unknown FDv2 payload type: ${payload.type}`);
          break;
      }
    },

    getSelector(): string | undefined {
      return selector;
    },

    getEnvironmentId(): string | undefined {
      return environmentId;
    },
  };
}
