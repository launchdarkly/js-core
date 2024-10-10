import { Context, LDLogger, LDPollingError, LDStreamingError } from '@launchdarkly/js-sdk-common';

import { FlagManager } from '../flag-manager/FlagManager';
import { ItemDescriptor } from '../flag-manager/ItemDescriptor';
import { DeleteFlag, Flags, PatchFlag } from '../types';
import { DataSourceState } from './DataSourceStatus';
import DataSourceStatusManager from './DataSourceStatusManager';

export default class DataSourceEventHandler {
  constructor(
    private readonly _flagManager: FlagManager,
    private readonly _statusManager: DataSourceStatusManager,
    private readonly _logger: LDLogger,
  ) {}

  async handlePut(context: Context, flags: Flags) {
    this._logger.debug(`Got PUT: ${Object.keys(flags)}`);

    // mapping flags to item descriptors
    const descriptors = Object.entries(flags).reduce(
      (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
        acc[key] = { version: flag.version, flag };
        return acc;
      },
      {},
    );
    await this._flagManager.init(context, descriptors);
    this._statusManager.requestStateUpdate(DataSourceState.Valid);
  }

  async handlePatch(context: Context, patchFlag: PatchFlag) {
    this._logger.debug(`Got PATCH ${JSON.stringify(patchFlag, null, 2)}`);
    this._flagManager.upsert(context, patchFlag.key, {
      version: patchFlag.version,
      flag: patchFlag,
    });
  }

  async handleDelete(context: Context, deleteFlag: DeleteFlag) {
    this._logger.debug(`Got DELETE ${JSON.stringify(deleteFlag, null, 2)}`);

    this._flagManager.upsert(context, deleteFlag.key, {
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
  }

  handleStreamingError(error: LDStreamingError) {
    this._statusManager.reportError(error.kind, error.message, error.code, error.recoverable);
  }

  handlePollingError(error: LDPollingError) {
    this._statusManager.reportError(error.kind, error.message, error.status, error.recoverable);
  }
}
