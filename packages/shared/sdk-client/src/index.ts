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
  TrackSeriesContext,
  LDInspection,
  LDIdentifyResult,
  LDIdentifySuccess,
  LDIdentifyError,
  LDIdentifyTimeout,
  LDIdentifyShed,
  LDClientIdentifyResult,
  LDPluginBase,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  LDWaitForInitializationComplete,
  LDWaitForInitializationFailed,
  LDWaitForInitializationTimeout,
  LDContext,
  LDContextStrict,
} from './api';

export type { DataManager, DataManagerFactory, ConnectionParams } from './DataManager';
export type { FlagManager, LDDebugOverride } from './flag-manager/FlagManager';
export { safeRegisterDebugOverridePlugins } from './plugins/safeRegisterDebugOverridePlugins';
export type { Configuration } from './configuration/Configuration';
export { default as validateOptions } from './configuration/validateOptions';

export type { LDEmitter };
export type { ItemDescriptor } from './flag-manager/ItemDescriptor';
export type { Flag } from './types';
export { readFlagsFromBootstrap } from './flag-manager/bootstrap';

export { DataSourcePaths } from './streaming';
export { browserFdv1Endpoints, mobileFdv1Endpoints, fdv2Endpoints } from './datasource/Endpoints';
export type { DataSourceEndpoints } from './datasource/Endpoints';
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

// FDv2 connection mode type system — public types.
// When FDv2 becomes the default, FDv2ConnectionMode should replace ConnectionMode
// in the api/ exports above.
export type {
  FDv2ConnectionMode,
  EndpointConfig,
  CacheDataSourceEntry,
  PollingDataSourceEntry,
  StreamingDataSourceEntry,
  DataSourceEntry,
  ModeDefinition,
  LDClientDataSystemOptions,
  AutomaticModeSwitchingConfig,
  PlatformDataSystemDefaults,
  LifecycleState,
  ModeState,
  ConfiguredMode,
  ModeResolution,
  ModeResolutionEntry,
  ModeResolutionTable,
} from './api/datasource';

// FDv2 data source orchestration — exported for platform SDK integration.
export type {
  FDv2DataSource,
  FDv2DataSourceConfig,
  DataCallback,
} from './datasource/fdv2/FDv2DataSource';
export { createFDv2DataSource } from './datasource/fdv2/FDv2DataSource';
export type { InitializerFactory, SynchronizerSlot } from './datasource/fdv2/SourceManager';
export { createSynchronizerSlot } from './datasource/fdv2/SourceManager';
export { makeFDv2Requestor } from './datasource/fdv2/FDv2Requestor';
export type { FDv2Requestor } from './datasource/fdv2/FDv2Requestor';
export { createCacheInitializerFactory } from './datasource/fdv2/CacheInitializer';
export type { CacheInitializerConfig } from './datasource/fdv2/CacheInitializer';
export { createPollingInitializer } from './datasource/fdv2/PollingInitializer';
export { createPollingSynchronizer } from './datasource/fdv2/PollingSynchronizer';
export type { PingHandler, StreamingFDv2Base } from './datasource/fdv2/StreamingFDv2Base';
export { createStreamingBase } from './datasource/fdv2/StreamingFDv2Base';
export { createStreamingInitializer } from './datasource/fdv2/StreamingInitializerFDv2';
export { createStreamingSynchronizer } from './datasource/fdv2/StreamingSynchronizerFDv2';
export { poll as fdv2Poll } from './datasource/fdv2/PollingBase';
export { flagEvalPayloadToItemDescriptors } from './datasource/flagEvalMapper';
export { createDataSourceStatusManager } from './datasource/DataSourceStatusManager';
export type { DataSourceStatusManager } from './datasource/DataSourceStatusManager';

// FDv2 data system validators and platform defaults.
export {
  dataSystemValidators,
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
} from './datasource/LDClientDataSystemOptions';

// FDv2 connection mode type system — internal implementation.
export type { ModeTable } from './datasource/ConnectionModeConfig';
export { MODE_TABLE } from './datasource/ConnectionModeConfig';
export {
  resolveConnectionMode,
  MOBILE_TRANSITION_TABLE,
  BROWSER_TRANSITION_TABLE,
  DESKTOP_TRANSITION_TABLE,
} from './datasource/ModeResolver';

// FDv2 shared data manager — mode switching, debouncing, and data source lifecycle.
export type {
  FDv2DataManagerBaseConfig,
  FDv2DataManagerControl,
} from './datasource/FDv2DataManagerBase';
export { createFDv2DataManagerBase } from './datasource/FDv2DataManagerBase';
export type {
  SourceFactoryContext,
  SourceFactoryProvider,
} from './datasource/SourceFactoryProvider';
export { createDefaultSourceFactoryProvider } from './datasource/SourceFactoryProvider';

// State debounce manager.
export type {
  StateDebounceManager,
  StateDebounceManagerConfig,
  NetworkState,
  PendingState,
  ReconciliationCallback,
} from './datasource/StateDebounceManager';
export { createStateDebounceManager } from './datasource/StateDebounceManager';
