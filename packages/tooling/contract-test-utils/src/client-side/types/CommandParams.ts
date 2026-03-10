import { LDContext, LDEvaluationReason } from '@launchdarkly/js-client-sdk-common';

import {
  CommandType,
  ContextBuildParams,
  ContextComparisonPairParams,
  ContextConvertParams,
  HookStage,
  ValueType,
} from '../../types/CommandParams';

// Re-export shared types for convenience
export { CommandType, ValueType } from '../../types/CommandParams';
export type {
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
} from '../../types/CommandParams';
export { HookStage } from '../../types/CommandParams';

export interface CommandParams {
  command: CommandType;
  evaluate?: EvaluateFlagParams;
  evaluateAll?: EvaluateAllFlagsParams;
  customEvent?: CustomEventParams;
  identifyEvent?: IdentifyEventParams;
  contextBuild?: ContextBuildParams;
  contextConvert?: ContextConvertParams;
  contextComparison?: ContextComparisonPairParams;
  secureModeHash?: SecureModeHashParams;
}

export interface EvaluateFlagParams {
  flagKey: string;
  context?: LDContext;
  user?: any;
  valueType: ValueType;
  defaultValue: unknown;
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
