import type {
  Hook,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk-common';

export interface LDFlagChangeset {
  [key: string]: {
    current: LDFlagValue;
    previous: LDFlagValue;
  };
}

export interface LDRendererClientCompat {
  waitUntilReady(): Promise<void>;
  waitForInitialization(timeout?: number): Promise<void>;
  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> | undefined;
  getContext(): LDContext | undefined;
  flush(onDone?: () => void): Promise<void> | undefined;
  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue;
  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail;
  setStreaming(value?: boolean): void;
  on(key: string, callback: (...args: any[]) => void, context?: any): void;
  off(key: string, callback: (...args: any[]) => void, context?: any): void;
  track(key: string, data?: any, metricValue?: number): void;
  allFlags(): LDFlagSet;
  close(onDone?: () => void): Promise<void>;
  addHook(hook: Hook): void;
  waitUntilGoalsReady(): Promise<void>;
}
