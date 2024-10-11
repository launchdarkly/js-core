import { LDClientInternalOptions } from './configuration/Configuration';
import DataSourceStatus, { DataSourceState } from './datasource/DataSourceStatus';
import DataSourceStatusErrorInfo from './datasource/DataSourceStatusErrorInfo';
import Requestor, { makeRequestor } from './datasource/Requestor';
import LDClientImpl from './LDClientImpl';
import LDEmitter, { EventName } from './LDEmitter';

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
  Hook,
  HookMetadata,
  EvaluationSeriesContext,
  EvaluationSeriesData,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
  IdentifySeriesStatus,
} from './api';

export type { DataManager, DataManagerFactory, ConnectionParams } from './DataManager';
export type { FlagManager } from './flag-manager/FlagManager';
export type { Configuration } from './configuration/Configuration';

export type { LDEmitter };
export type { ItemDescriptor } from './flag-manager/ItemDescriptor';
export type { Flag } from './types';

export { DataSourcePaths } from './streaming';
export { BaseDataManager } from './DataManager';
export { makeRequestor, Requestor };

export {
  DataSourceStatus,
  DataSourceStatusErrorInfo,
  LDClientImpl,
  LDClientInternalOptions,
  DataSourceState,
  EventName as LDEmitterEventName,
};
