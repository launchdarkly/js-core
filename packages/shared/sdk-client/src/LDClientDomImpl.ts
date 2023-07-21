// temporarily allow unused vars for the duration of the migration
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  Platform,
} from '@launchdarkly/js-sdk-common';
import { LDClientDom } from './api/LDClientDom';
import Configuration from './options/Configuration';
import LDOptions from './options/LDOptions';

export default class LDClientDomImpl implements LDClientDom {
  config: Configuration;

  /**
   * Immediately return an LDClient instance. No async or remote calls.
   *
   * @param clientSideId
   * @param context
   * @param options
   * @param platform
   */
  constructor(clientSideId: string, context: LDContext, options: LDOptions, platform: Platform) {
    this.config = new Configuration(options);
  }

  allFlags(): LDFlagSet {
    return {};
  }

  close(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  flush(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getContext(): LDContext {
    return { kind: 'user', key: 'test-context-1' };
  }

  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void
  ): Promise<LDFlagSet> {
    return Promise.resolve({});
  }

  off(key: string, callback: (...args: any[]) => void, context?: any): void {}

  on(key: string, callback: (...args: any[]) => void, context?: any): void {}

  setStreaming(value?: boolean): void {}

  track(key: string, data?: any, metricValue?: number): void {}

  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue {
    return undefined;
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    const defaultDetail = {
      value: defaultValue,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
    };
    return defaultDetail;
  }

  waitForInitialization(): Promise<void> {
    return Promise.resolve(undefined);
  }

  waitUntilReady(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
