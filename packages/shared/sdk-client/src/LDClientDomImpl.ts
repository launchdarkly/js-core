// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Context,
  internal,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { LDClientDom } from './api/LDClientDom';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import createEventProcessor from './events/createEventProcessor';
import { PlatformDom, Storage } from './platform/PlatformDom';

export default class LDClientDomImpl implements LDClientDom {
  config: Configuration;
  ldContext: LDContext;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;
  storage: Storage;
  private streamer?: subsystem.LDStreamProcessor;

  constructor(clientSideID: string, context: LDContext, options: LDOptions, platform: PlatformDom) {
    if (!clientSideID) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      throw new Error('Context was unspecified or had no key');
    }

    this.ldContext = context;
    this.config = new Configuration(options);
    this.storage = platform.storage;
    this.diagnosticsManager = createDiagnosticsManager(clientSideID, this.config, platform);
    this.eventProcessor = createEventProcessor(
      clientSideID,
      this.config,
      platform,
      this.diagnosticsManager,
    );

    // if (this.config.stream) {
    //   this.streamer = new internal.StreamingProcessor(
    //     sdkKey,
    //     clientContext,
    //     listeners,
    //     this.diagnosticsManager,
    //     (e) => this.dataSourceErrorHandler(e),
    //     this.config.streamInitialReconnectDelay,
    //   );
    // }
  }

  /**
   * TODO:
   */
  async start() {
    const flags = await fetch(this.config.serviceEndpoints.polling);
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
