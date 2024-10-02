import { LDClientInternalOptions } from './configuration/Configuration';
import DataSourceStatus, { DataSourceState } from './datasource/DataSourceStatus';
import DataSourceStatusErrorInfo from './datasource/DataSourceStatusErrorInfo';
import LDClientImpl from './LDClientImpl';
import LDEmitter, { EventName } from './LDEmitter';
import Requestor from './polling/Requestor';

export * from '@launchdarkly/js-sdk-common';

export * as platform from '@launchdarkly/js-sdk-common';

// To replace the exports from `export *` we need to name them.
// So the below exports replace them with the Node specific variants.

// These exports are explicit to override those from common.
export type {
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDClient,
  LDOptions,
  ConnectionMode,
  LDIdentifyOptions,
} from './api';

export type { DataManager, DataManagerFactory, ConnectionParams } from './DataManager';
export type { FlagManager } from './flag-manager/FlagManager';
export type { Configuration } from './configuration/Configuration';

export type { LDEmitter };

export { DataSourcePaths } from './streaming';
export { BaseDataManager } from './DataManager';
export { Requestor };

export {
  DataSourceStatus,
  DataSourceStatusErrorInfo,
  LDClientImpl,
  LDClientInternalOptions,
  DataSourceState,
  EventName as LDEmitterEventName,
};
