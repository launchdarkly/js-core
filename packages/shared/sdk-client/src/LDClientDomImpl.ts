// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Context,
  internal,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { LDClientDom } from './api/LDClientDom';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import fetchFlags from './evaluation/fetchFlags';
import createEventProcessor from './events/createEventProcessor';

export default class LDClientDomImpl implements LDClientDom {
  config: Configuration;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly context: LDContext,
    public readonly platform: Platform,
    options: LDOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      throw new Error('Context was unspecified or had no key');
    }

    this.config = new Configuration(options);
    this.diagnosticsManager = createDiagnosticsManager(sdkKey, this.config, platform);
    this.eventProcessor = createEventProcessor(
      sdkKey,
      this.config,
      platform,
      this.diagnosticsManager,
    );
    // TODO: create streamer
  }

  async start() {
    const flags = await fetchFlags(this.sdkKey, this.context, this.config, this.platform);
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
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void,
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
