// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { LDClientDom } from './api/LDClientDom';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createEventProcessor from './events/createEventProcessor';
import { PlatformDom, Storage } from './platform/PlatformDom';

export default class LDClientDomImpl implements LDClientDom {
  config: Configuration;
  eventProcessor: subsystem.LDEventProcessor;
  storage: Storage;

  constructor(clientSideID: string, context: LDContext, options: LDOptions, platform: PlatformDom) {
    this.config = new Configuration(options);
    this.eventProcessor = createEventProcessor(clientSideID, this.config, platform);
    this.storage = platform.storage;
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
