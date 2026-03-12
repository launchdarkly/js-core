import { LDContext, LDEvaluationReason } from './compat.js';

export const CommandType = {
  EvaluateFlag: 'evaluate',
  EvaluateAllFlags: 'evaluateAll',
  IdentifyEvent: 'identifyEvent',
  CustomEvent: 'customEvent',
  AliasEvent: 'aliasEvent',
  FlushEvents: 'flushEvents',
  ContextBuild: 'contextBuild',
  ContextConvert: 'contextConvert',
  ContextComparison: 'contextComparison',
  SecureModeHash: 'secureModeHash',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CommandType = (typeof CommandType)[keyof typeof CommandType];

export const ValueType = {
  Bool: 'bool',
  Int: 'int',
  Double: 'double',
  String: 'string',
  Any: 'any',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ValueType = (typeof ValueType)[keyof typeof ValueType];

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

export interface EvaluateAllFlagsResponse {
  state: Record<string, unknown>;
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

export interface ContextBuildParams {
  single?: ContextBuildSingleParams;
  multi?: ContextBuildSingleParams[];
}

export interface ContextBuildSingleParams {
  kind?: string;
  key: string;
  name?: string;
  anonymous?: boolean;
  private?: string[];
  custom?: Record<string, unknown>;
}

export interface ContextBuildResponse {
  output: string;
  error: string;
}

export interface ContextConvertParams {
  input: string;
}

export interface ContextComparisonPairParams {
  context1: ContextComparisonParams;
  context2: ContextComparisonParams;
}

export interface ContextComparisonParams {
  single?: ContextComparisonSingleParams;
  multi?: ContextComparisonSingleParams[];
}

export interface ContextComparisonSingleParams {
  kind: string;
  key: string;
  attributes?: AttributeDefinition[];
  privateAttributes?: PrivateAttribute[];
}

export interface AttributeDefinition {
  name: string;
  value?: unknown;
}

export interface PrivateAttribute {
  value: string;
  literal: boolean;
}

export interface ContextComparisonResponse {
  equals: boolean;
}

export interface SecureModeHashParams {
  context?: LDContext;
  user?: any;
}

export interface SecureModeHashResponse {
  result: string;
}

export const HookStage = {
  BeforeEvaluation: 'beforeEvaluation',
  AfterEvaluation: 'afterEvaluation',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HookStage = (typeof HookStage)[keyof typeof HookStage];

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
  defaultStage: string;
}

export interface MigrationOperationParams {
  operation: string;
  key: string;
  context: LDContext;
  defaultStage: string;
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
