// Shared command types with no SDK-specific dependencies.
// SDK-specific types (those referencing LDContext/LDEvaluationReason) are in
// client-side/types/CommandParams.ts and server-side/types/CommandParams.ts.

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
export type CommandType = (typeof CommandType)[keyof typeof CommandType];

export const ValueType = {
  Bool: 'bool',
  Int: 'int',
  Double: 'double',
  String: 'string',
  Any: 'any',
} as const;
export type ValueType = (typeof ValueType)[keyof typeof ValueType];

export interface EvaluateAllFlagsResponse {
  state: Record<string, unknown>;
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

export interface SecureModeHashResponse {
  result: string;
}

export const HookStage = {
  BeforeEvaluation: 'beforeEvaluation',
  AfterEvaluation: 'afterEvaluation',
} as const;
export type HookStage = (typeof HookStage)[keyof typeof HookStage];
