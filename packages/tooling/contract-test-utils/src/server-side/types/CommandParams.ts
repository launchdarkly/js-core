import { LDContext, LDEvaluationReason, LDMigrationStage } from '@launchdarkly/js-server-sdk-common';

import {
  CommandType,
  ContextBuildParams,
  ContextComparisonPairParams,
  ContextConvertParams,
  HookStage,
  ValueType,
} from '../../types/CommandParams.js';

// Re-export shared types for convenience
export {
  CommandType,
  ValueType,
  EvaluateAllFlagsResponse,
  ContextBuildParams,
  ContextBuildSingleParams,
  ContextBuildResponse,
  ContextConvertParams,
  ContextComparisonPairParams,
  ContextComparisonParams,
  ContextComparisonSingleParams,
  AttributeDefinition,
  PrivateAttribute,
  ContextComparisonResponse,
  SecureModeHashResponse,
  HookStage,
} from '../../types/CommandParams.js';

export interface CommandParams {
  command: CommandType | string;
  evaluate?: EvaluateFlagParams;
  evaluateAll?: EvaluateAllFlagsParams;
  customEvent?: CustomEventParams;
  identifyEvent?: IdentifyEventParams;
  contextBuild?: ContextBuildParams;
  contextConvert?: ContextConvertParams;
  contextComparison?: ContextComparisonPairParams;
  secureModeHash?: SecureModeHashParams;
  // Server-specific command fields
  migrationVariation?: MigrationVariationParams;
  migrationOperation?: MigrationOperationParams;
  registerFlagChangeListener?: RegisterFlagChangeListenerParams;
  unregisterListener?: UnregisterListenerParams;
}

export interface EvaluateFlagParams {
  flagKey: string;
  context?: LDContext;
  user?: any;
  valueType: ValueType;
  defaultValue: any;
  detail: boolean;
}

export interface EvaluateFlagResponse {
  value: unknown;
  variationIndex?: number;
  reason?: LDEvaluationReason;
}

export interface EvaluateAllFlagsParams {
  context?: LDContext;
  user?: any;
  withReasons: boolean;
  clientSideOnly: boolean;
  detailsOnlyForTrackedFlags: boolean;
}

export interface CustomEventParams {
  eventKey: string;
  context?: LDContext;
  user?: any;
  data?: unknown;
  omitNullData: boolean;
  metricValue?: number;
}

export interface IdentifyEventParams {
  context?: LDContext;
  user?: any;
}

export interface SecureModeHashParams {
  context?: LDContext;
  user?: any;
}

export interface EvaluationSeriesContext {
  flagKey: string;
  context: LDContext;
  defaultValue: unknown;
  method: string;
}

export interface HookExecutionPayload {
  evaluationSeriesContext?: EvaluationSeriesContext;
  evaluationSeriesData?: Record<string, unknown>;
  evaluationDetail?: EvaluateFlagResponse;
  stage?: HookStage;
}

// Server-specific command parameter types

export interface MigrationVariationParams {
  key: string;
  context: LDContext;
  defaultStage: LDMigrationStage;
}

export interface MigrationOperationParams {
  operation: string;
  key: string;
  context: LDContext;
  defaultStage: LDMigrationStage;
  payload: any;
  readExecutionOrder: string;
  trackLatency?: boolean;
  trackErrors?: boolean;
  trackConsistency?: boolean;
  newEndpoint: string;
  oldEndpoint: string;
}

export interface RegisterFlagChangeListenerParams {
  listenerId: string;
  callbackUri: string;
}

export interface UnregisterListenerParams {
  listenerId: string;
}
