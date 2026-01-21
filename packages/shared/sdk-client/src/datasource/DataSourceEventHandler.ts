import { Context, LDLogger, LDPollingError, LDStreamingError } from '@launchdarkly/js-sdk-common';

import { FlagManager } from '../flag-manager/FlagManager';
import { ItemDescriptor } from '../flag-manager/ItemDescriptor';
import { DeleteFlag, Flags, PatchFlag } from '../types';
import { DataSourceState } from './DataSourceStatus';
import { DataSourceStatusManager } from './DataSourceStatusManager';

export interface DataSourceEventHandler {
  handlePut(context: Context, flags: Flags): Promise<void>;
  handlePatch(context: Context, patchFlag: PatchFlag): Promise<void>;
  handleDelete(context: Context, deleteFlag: DeleteFlag): Promise<void>;
  handleStreamingError(error: LDStreamingError): void;
  handlePollingError(error: LDPollingError): void;
}

export function createDataSourceEventHandler(
  flagManager: FlagManager,
  statusManager: DataSourceStatusManager,
  logger: LDLogger,
): DataSourceEventHandler {
  return {
    async handlePut(context: Context, flags: Flags) {
      logger.debug(`Got PUT: ${Object.keys(flags)}`);

      // mapping flags to item descriptors
      const descriptors = Object.entries(flags).reduce(
        (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
          acc[key] = { version: flag.version, flag };
          return acc;
        },
        {},
      );
      await flagManager.init(context, descriptors);
      statusManager.requestStateUpdate(DataSourceState.Valid);
    },

    async handlePatch(context: Context, patchFlag: PatchFlag) {
      logger.debug(`Got PATCH ${JSON.stringify(patchFlag, null, 2)}`);
      flagManager.upsert(context, patchFlag.key, {
        version: patchFlag.version,
        flag: patchFlag,
      });
    },

    async handleDelete(context: Context, deleteFlag: DeleteFlag) {
      logger.debug(`Got DELETE ${JSON.stringify(deleteFlag, null, 2)}`);

      flagManager.upsert(context, deleteFlag.key, {
        version: deleteFlag.version,
        flag: {
          ...deleteFlag,
          deleted: true,
          // props below are set to sensible defaults. they are irrelevant
          // because this flag has been deleted.
          flagVersion: 0,
          value: undefined,
          variation: 0,
          trackEvents: false,
        },
      });
    },

    handleStreamingError(error: LDStreamingError) {
      statusManager.reportError(error.kind, error.message, error.code, error.recoverable);
    },

    handlePollingError(error: LDPollingError) {
      statusManager.reportError(error.kind, error.message, error.status, error.recoverable);
    },
  };
}

export default DataSourceEventHandler;
