import {
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  Platform,
} from '@launchdarkly/js-sdk-common';
import { LDClientDom } from '../api/LDClientDom';
import { LDOptions } from '@launchdarkly/js-server-sdk-common';

export default class LDClientDomImpl implements LDClientDomImpl {
  constructor(
    private sdkKey: string,
    private platform: Platform,
    options: LDOptions
    // callbacks: LDClientCallbacks
  ) {}

  allFlags(): LDFlagSet {
    return undefined;
  }

  close(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  flush(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getContext(): LDContext {
    return undefined;
  }

  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void
  ): Promise<LDFlagSet> {
    return Promise.resolve(undefined);
  }

  off(key: string, callback: (...args: any[]) => void, context?: any): void {}

  on(key: string, callback: (...args: any[]) => void, context?: any): void {}

  setStreaming(value?: boolean): void {}

  track(key: string, data?: any, metricValue?: number): void {}

  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue {
    return undefined;
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return undefined;
  }

  waitForInitialization(): Promise<void> {
    return Promise.resolve(undefined);
  }

  waitUntilReady(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
