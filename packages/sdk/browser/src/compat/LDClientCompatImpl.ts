// TODO may or may not need this.
import {
  AutoEnvAttributes,
  cancelableTimedPromise,
  Hook,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
  LDTimeoutError,
} from '@launchdarkly/js-client-sdk-common';

import { makeClient } from '../BrowserClient';
import { LDClient as BrowserLDClient } from '../LDClient';
import { LDClient } from './LDClientCompat';
import { LDOptions } from './LDCompatOptions';
import LDEmitterCompat, { CompatEventName } from './LDEmitterCompat';
import { wrapPromiseCallback } from './wrapPromiseCallback';

export default class LDClientCompatImpl implements LDClient {
  private _client: BrowserLDClient;
  public readonly logger: LDLogger;

  private _initResolve?: () => void;

  private _initReject?: (err: Error) => void;

  private _rejectionReason: Error | undefined;

  private _initializedPromise?: Promise<void>;

  private _initState: 'success' | 'failure' | 'initializing' = 'initializing';

  private _emitter: LDEmitterCompat;

  constructor(envKey: string, context: LDContext, options?: LDOptions) {
    const bootstrap = options?.bootstrap;
    const hash = options?.hash;

    const cleanedOptions = { ...options };
    delete cleanedOptions.bootstrap;
    delete cleanedOptions.hash;
    this._client = makeClient(envKey, context, AutoEnvAttributes.Disabled, options);
    this._emitter = new LDEmitterCompat(this._client);
    this.logger = this._client.logger;
    this._initIdentify(context, bootstrap, hash);
  }

  private async _initIdentify(
    context: LDContext,
    bootstrap?: LDFlagSet,
    hash?: string,
  ): Promise<void> {
    try {
      const result = await this._client.identify(context, {
        noTimeout: true,
        bootstrap,
        hash,
        sheddable: false,
      });

      if (result.status === 'error') {
        throw result.error;
      } else if (result.status === 'timeout') {
        throw new LDTimeoutError('Identify timed out');
      }
      // status === 'completed' ('shed' cannot happen with sheddable: false)

      this._initState = 'success';
      this._initResolve?.();
      this._emitter.emit('initialized');
    } catch (err) {
      this._rejectionReason = err as Error;
      this._initState = 'failure';
      this._initReject?.(err as Error);
      this._emitter.emit('failed', err);
    }
    // Ready will always be emitted in addition to either 'initialized' or 'failed'.
    this._emitter.emit('ready');
  }

  allFlags(): LDFlagSet {
    return this._client.allFlags();
  }

  boolVariation(key: string, defaultValue: boolean): boolean {
    return this._client.boolVariation(key, defaultValue);
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    return this._client.boolVariationDetail(key, defaultValue);
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this._client.jsonVariation(key, defaultValue);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this._client.jsonVariationDetail(key, defaultValue);
  }

  numberVariation(key: string, defaultValue: number): number {
    return this._client.numberVariation(key, defaultValue);
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    return this._client.numberVariationDetail(key, defaultValue);
  }

  off(key: CompatEventName, callback: (...args: any[]) => void): void {
    this._emitter.off(key, callback);
  }

  on(key: CompatEventName, callback: (...args: any[]) => void): void {
    this._emitter.on(key, callback);
  }

  stringVariation(key: string, defaultValue: string): string {
    return this._client.stringVariation(key, defaultValue);
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    return this._client.stringVariationDetail(key, defaultValue);
  }

  track(key: string, data?: any, metricValue?: number): void {
    this._client.track(key, data, metricValue);
  }

  variation(key: string, defaultValue?: LDFlagValue) {
    return this._client.variation(key, defaultValue);
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this._client.variationDetail(key, defaultValue);
  }

  addHook(hook: Hook): void {
    this._client.addHook(hook);
  }

  setStreaming(streaming?: boolean): void {
    this._client.setStreaming(streaming);
  }

  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> | undefined {
    return wrapPromiseCallback(
      this._client.identify(context, { hash, sheddable: false }).then((result) => {
        // Check if identification was successful
        if (result.status === 'error') {
          throw result.error;
        } else if (result.status === 'timeout') {
          throw new LDTimeoutError('Identify timed out');
        }
        // status === 'completed' ('shed' cannot happen with sheddable: false)
        return this.allFlags();
      }),
      onDone,
    ) as Promise<LDFlagSet> | undefined;
    // The typing here is a little funny. The wrapPromiseCallback can technically return
    // `Promise<T | undefined>`, but in the case where it would resolve to undefined we are not
    // actually using the promise, because it means a callback was specified.
  }

  close(onDone?: () => void): Promise<void> | undefined {
    return wrapPromiseCallback(this._client.close().then(), onDone);
  }

  flush(onDone?: () => void): Promise<void> | undefined {
    // The .then() is to strip the return value making a void promise.
    return wrapPromiseCallback(
      this._client.flush().then(() => undefined),
      onDone,
    );
  }

  getContext(): LDContext | undefined {
    return this._client.getContext();
  }

  waitForInitialization(timeout?: number): Promise<void> {
    // An initialization promise is only created if someone is going to use that promise.
    // If we always created an initialization promise, and there was no call waitForInitialization
    // by the time the promise was rejected, then that would result in an unhandled promise
    // rejection.

    // It waitForInitialization was previously called, then we can use that promise even if it has
    // been resolved or rejected.
    if (this._initializedPromise) {
      return this._promiseWithTimeout(this._initializedPromise, timeout);
    }

    switch (this._initState) {
      case 'success':
        return Promise.resolve();
      case 'failure':
        return Promise.reject(this._rejectionReason);
      case 'initializing':
        // Continue with the existing logic for creating and handling the promise
        break;
      default:
        throw new Error(
          'Unexpected initialization state. This represents an implementation error in the SDK.',
        );
    }

    if (timeout === undefined) {
      this.logger?.warn(
        'The waitForInitialization function was called without a timeout specified.' +
          ' In a future version a default timeout will be applied.',
      );
    }

    if (!this._initializedPromise) {
      this._initializedPromise = new Promise((resolve, reject) => {
        this._initResolve = resolve;
        this._initReject = reject;
      });
    }

    return this._promiseWithTimeout(this._initializedPromise, timeout);
  }

  async waitUntilReady(): Promise<void> {
    try {
      await this.waitForInitialization();
    } catch {
      // We do not care about the error.
    }
  }

  /**
   * Apply a timeout promise to a base promise. This is for use with waitForInitialization.
   * Currently it returns a LDClient. In the future it should return a status.
   *
   * The client isn't always the expected type of the consumer. It returns an LDClient interface
   * which is less capable than, for example, the node client interface.
   *
   * @param basePromise The promise to race against a timeout.
   * @param timeout The timeout in seconds.
   * @param logger A logger to log when the timeout expires.
   * @returns
   */
  private _promiseWithTimeout(basePromise: Promise<void>, timeout?: number): Promise<void> {
    if (timeout) {
      const cancelableTimeout = cancelableTimedPromise(timeout, 'waitForInitialization');
      return Promise.race([
        basePromise.then(() => cancelableTimeout.cancel()),
        cancelableTimeout.promise,
      ]).catch((reason) => {
        if (reason instanceof LDTimeoutError) {
          this.logger?.error(reason.message);
        }
        throw reason;
      });
    }
    return basePromise;
  }
}
