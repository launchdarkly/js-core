// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Context,
  internal,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
  PlatformDom,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { LDClientDom } from './api/LDClientDom';
import LDEmitter, { EventName } from './api/LDEmitter';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import fetchFlags, { Flags } from './evaluation/fetchFlags';
import createEventProcessor from './events/createEventProcessor';

export default class LDClientDomImpl implements LDClientDom {
  config: Configuration;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;
  private emitter: LDEmitter;
  private flags: Flags = {};
  private logger: LDLogger;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly context: LDContext,
    public readonly platform: PlatformDom,
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
    this.logger = this.config.logger;
    this.diagnosticsManager = createDiagnosticsManager(sdkKey, this.config, platform);
    this.eventProcessor = createEventProcessor(
      sdkKey,
      this.config,
      platform,
      this.diagnosticsManager,
    );
    this.emitter = new LDEmitter();
  }

  async start() {
    try {
      this.flags = await fetchFlags(this.sdkKey, this.context, this.config, this.platform);
      this.emitter.emit('ready');
    } catch (error: any) {
      this.logger.error(error);
      this.emitter.emit('error', error);
      this.emitter.emit('failed', error);
    }
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

  off(eventName: EventName, listener?: Function): void {
    this.emitter.off(eventName, listener);
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

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
