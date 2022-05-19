/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import {
  LDClientImpl, LDContext, LDEvaluationDetail, LDFlagsState, LDFlagsStateOptions, LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import EventEmitter from 'events';
import { LDClient } from './api/LDClient';
import BigSegmentStoreStatusProviderNode from './BigSegmentsStoreStatusProviderNode';
import { BigSegmentStoreStatusProvider } from './api/interfaces/BigSegmentStoreStatusProvider';
import NodePlatform from './platform/NodePlatform';

export default class LDClientNode extends EventEmitter implements LDClient {
  /**
   * The LDClientImpl is included through composition, instead of inheritance,
   * for a couple of reasons.
   * 1. This allows the node client to implement EventEmitter, where otherwise
   * it would be unable to from single inheritance. EventEmitter is not included
   * in common because it is node specific.
   *
   * 2. This allows conversions of some types compared to the base implementation.
   * Such as returning a node `LDClient` instead of the base `LDClient` interface.
   * This interface extends EventEmitter to support #1.
   */
  private client: LDClientImpl;

  constructor(options: LDOptions) {
    super();
    // TODO: Remember to parse the options before providing them to the platform.
    this.client = new LDClientImpl(new NodePlatform(options));
    // Extend the BigSegmentStoreStatusProvider from the common client to allow
    // for use of the event emitter.
    this.bigSegmentStoreStatusProvider = new BigSegmentStoreStatusProviderNode(this.client);
  }

  bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

  initialized(): boolean {
    return this.client.initialized();
  }

  async waitForInitialization(): Promise<LDClient> {
    await this.client.waitForInitialization();
    return this;
  }

  variation(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: any) => void,
  ): Promise<any> {
    return this.client.variation(key, context, defaultValue, callback);
  }

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail> {
    return this.client.variationDetail(key, context, defaultValue, callback);
  }

  allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    return this.client.allFlagsState(context, options, callback);
  }

  secureModeHash(context: LDContext): string {
    return this.client.secureModeHash(context);
  }

  close(): void {
    this.client.close();
  }

  isOffline(): boolean {
    return this.client.isOffline();
  }

  track(key: string, context: LDContext, data?: any, metricValue?: number): void {
    return this.client.track(key, context, data, metricValue);
  }

  identify(context: LDContext): void {
    return this.client.identify(context);
  }

  flush(callback?: (err: Error, res: boolean) => void): Promise<void> {
    return this.client.flush(callback);
  }
}
