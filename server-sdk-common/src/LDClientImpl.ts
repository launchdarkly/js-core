/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { LDContext } from '@launchdarkly/js-sdk-common';
import {
  LDClient, LDEvaluationDetail, LDFlagsState, LDFlagsStateOptions,
} from './api';
import BigSegmentsManager from './BigSegmentsManager';
import BigSegmentStoreStatusProvider from './BigSegmentStatusProviderImpl';
import { Platform } from './platform';

enum EventTypes {
  /**
   * Emitted on errors other than a failure to initialize.
   */
  Error = 'error',
  /**
   * Emitted when the SDK fails to initialize.
   */
  Failed = 'failed',
  /**
   * Emitted when the SDK is ready to use.
   */
  Ready = 'ready',
}

enum InitState {
  Initializing,
  Initialized,
  Failed,
}

export default class LDClientImpl implements LDClient {
  private platform: Platform;

  private initState: InitState = InitState.Initializing;

  protected bigSegmentStatusProviderInternal: BigSegmentStoreStatusProvider;

  /**
   * This field should be overridden by implementations.
   */
  bigSegmentsStatusProvider: BigSegmentStoreStatusProvider;

  constructor(
    targetPlatform: Platform,
  ) {
    this.platform = targetPlatform;
    const manager = new BigSegmentsManager(undefined, {}, undefined);
    this.bigSegmentStatusProviderInternal = manager.statusProvider as BigSegmentStoreStatusProvider;
    this.bigSegmentsStatusProvider = this.bigSegmentStatusProviderInternal;
  }

  initialized(): boolean {
    return this.initState === InitState.Initialized;
  }

  waitForInitialization(): Promise<LDClient> {
    throw new Error('Method not implemented.');
  }

  variation(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: any) => void,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail> {
    throw new Error('Method not implemented.');
  }

  allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    throw new Error('Method not implemented.');
  }

  secureModeHash(context: LDContext): string {
    throw new Error('Method not implemented.');
  }

  close(): void {
    throw new Error('Method not implemented.');
  }

  isOffline(): boolean {
    throw new Error('Method not implemented.');
  }

  track(key: string, context: LDContext, data?: any, metricValue?: number): void {
    throw new Error('Method not implemented.');
  }

  identify(context: LDContext): void {
    throw new Error('Method not implemented.');
  }

  flush(callback?: (err: Error, res: boolean) => void): Promise<void> {
    throw new Error('Method not implemented.');
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
}
