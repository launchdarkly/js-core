import { LDClientInternalOptions } from './configuration/Configuration';
import DataSourceStatus, { DataSourceState } from './datasource/DataSourceStatus';
import DataSourceStatusErrorInfo from './datasource/DataSourceStatusErrorInfo';
import { makeRequestor, Requestor } from './datasource/Requestor';
import LDClientImpl from './LDClientImpl';
import LDEmitter, { EventName } from './LDEmitter';

export * from '@launchdarkly/js-sdk-common';
export * as platform from '@launchdarkly/js-sdk-common';

// To replace the exports from `export *` we need to name them.
// So the below exports replace them with the Node specific variants.

// These exports are explicit to override those from common.
export type {
  ConnectionMode,
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  HookMetadata,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
  IdentifySeriesStatus,
  LDClient,
  LDClientIdentifyResult,
  LDContext,
  LDContextStrict,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDIdentifyError,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDIdentifyShed,
  LDIdentifySuccess,
  LDIdentifyTimeout,
  LDInspection,
  LDOptions,
  LDPluginBase,
  LDStartOptions,
  LDWaitForInitializationComplete,
  LDWaitForInitializationFailed,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  LDWaitForInitializationTimeout,
  TrackSeriesContext,
} from './api';
export type { Configuration } from './configuration/Configuration';
export { default as validateOptions } from './configuration/validateOptions';
export type { ConnectionParams, DataManager, DataManagerFactory } from './DataManager';
export type { FlagManager, LDDebugOverride } from './flag-manager/FlagManager';
export { safeRegisterDebugOverridePlugins } from './plugins/safeRegisterDebugOverridePlugins';

export type { LDEmitter };
export { BaseDataManager } from './DataManager';
export type { DataSourceEndpoints } from './datasource/Endpoints';
export { browserFdv1Endpoints, fdv2Endpoints, mobileFdv1Endpoints } from './datasource/Endpoints';
export { readFlagsFromBootstrap } from './flag-manager/bootstrap';
export type { ItemDescriptor } from './flag-manager/ItemDescriptor';
export { DataSourcePaths } from './streaming';
export type { Flag } from './types';
export { makeRequestor, Requestor };

export {
  DataSourceState,
  DataSourceStatus,
  DataSourceStatusErrorInfo,
  LDClientImpl,
  LDClientInternalOptions,
  EventName as LDEmitterEventName,
};

// FDv2 connection mode type system — public types.
// When FDv2 becomes the default, FDv2ConnectionMode should replace ConnectionMode
// in the api/ exports above.
export type {
  AutomaticModeSwitchingConfig,
  CacheDataSourceEntry,
  ConfiguredMode,
  DataSourceEntry,
  EndpointConfig,
  FDv2ConnectionMode,
  InitializerEntry,
  LDClientDataSystemOptions,
  LifecycleState,
  ManualModeSwitching,
  ModeDefinition,
  ModeResolution,
  ModeResolutionEntry,
  ModeResolutionTable,
  ModeState,
  PollingDataSourceEntry,
  StreamingDataSourceEntry,
  SynchronizerEntry,
} from './api/datasource';

// FDv2 data source status manager.
export type { DataSourceStatusManager } from './datasource/DataSourceStatusManager';
export { createDataSourceStatusManager } from './datasource/DataSourceStatusManager';

// FDv2 data system validators and platform defaults.
export type {
  InternalDataSystemOptions,
  PlatformDataSystemDefaults,
} from './datasource/LDClientDataSystemOptions';
export {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  dataSystemValidators,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  resolveForegroundMode,
} from './datasource/LDClientDataSystemOptions';

// FDv2 connection mode type system — internal implementation.
export type { ModeTable } from './datasource/ConnectionModeConfig';
export { MODE_TABLE } from './datasource/ConnectionModeConfig';
export {
  BROWSER_TRANSITION_TABLE,
  DESKTOP_TRANSITION_TABLE,
  MOBILE_TRANSITION_TABLE,
  resolveConnectionMode,
} from './datasource/ModeResolver';

// FDv2 source factory provider — converts declarative config to concrete factories.
export type {
  SourceFactoryContext,
  SourceFactoryProvider,
} from './datasource/SourceFactoryProvider';
export { createDefaultSourceFactoryProvider } from './datasource/SourceFactoryProvider';

// FDv2 shared data manager — mode switching, debouncing, and data source lifecycle.
export type {
  FDv2DataManagerBaseConfig,
  FDv2DataManagerControl,
} from './datasource/FDv2DataManagerBase';
export { createFDv2DataManagerBase } from './datasource/FDv2DataManagerBase';

// State debounce manager.
export type {
  NetworkState,
  PendingState,
  ReconciliationCallback,
  StateDebounceManager,
  StateDebounceManagerConfig,
} from './datasource/StateDebounceManager';
export { createStateDebounceManager } from './datasource/StateDebounceManager';
