import type {
  Hook,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronLDRendererClient } from '../renderer/ElectronLDRendererClient';
import type { LDFlagChangeset, LDRendererClientCompat } from './LDRendererClientCompat';

export class ElectronLDRendererClientCompat implements LDRendererClientCompat {
  private _wrappedClient: ElectronLDRendererClient;
  private _wrappedCallbacks: Map<Function, Function> = new Map();

  constructor(clientSideId: string) {
    this._wrappedClient = new ElectronLDRendererClient(clientSideId);
  }

  waitUntilReady(): Promise<void> {
    return Promise.resolve();
  }
  waitForInitialization(_timeout?: number): Promise<void> {
    return Promise.resolve();
  }
  identify(
    context: LDContext,
    _hash?: string,
    onDone?: (err: Error | null, flags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> | undefined {
    return this._wrappedClient
      .identify(context)
      .then(() => {
        const allFlags = this._wrappedClient.allFlags();
        if (typeof onDone === 'function') {
          onDone(null, allFlags);
          return undefined;
        }
        return Promise.resolve(allFlags);
      })
      .catch((e) => {
        if (typeof onDone === 'function') {
          onDone(e, null);
          return undefined;
        }
        return Promise.reject(e);
      }) as Promise<LDFlagSet> | undefined;
  }
  getContext(): LDContext | undefined {
    return this._wrappedClient.getContext();
  }
  flush(onDone?: () => void): Promise<void> | undefined {
    return this._wrappedClient.flush().then(() => {
      if (typeof onDone === 'function') {
        onDone();
        return undefined;
      }
      return Promise.resolve();
    });
  }
  variation(key: string, defaultValue?: LDFlagValue) {
    return this._wrappedClient.variation(key, defaultValue);
  }
  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this._wrappedClient.variationDetail(key, defaultValue);
  }
  setStreaming(value: boolean = true): void {
    this._wrappedClient.setConnectionMode(value ? 'streaming' : 'polling');
  }
  on(key: string, callback: (...args: any[]) => void, _context?: any): void {
    if (key === 'change') {
      let wrappedCallback = this._wrappedCallbacks.get(callback);
      if (!wrappedCallback) {
        wrappedCallback = (_cbContext: LDContext, flags: string[]) => {
          const changes: LDFlagChangeset = {};
          flags.forEach((flagKey) => {
            changes[flagKey] = {
              current: this.variation(flagKey),
              previous: undefined,
            };
          });
          callback(changes);
        };
        this._wrappedCallbacks.set(callback, wrappedCallback);
      }
      this._wrappedClient.on(key, wrappedCallback as (...args: any[]) => void);
    } else {
      this._wrappedClient.on(key, callback);
    }
  }
  off(key: string, callback: (...args: any[]) => void, _context?: any): void {
    if (key === 'change') {
      if (this._wrappedCallbacks.has(callback)) {
        this._wrappedClient.off(
          key,
          this._wrappedCallbacks.get(callback) as (...args: any[]) => void,
        );
        this._wrappedCallbacks.delete(callback);
      }
    } else {
      this._wrappedClient.off(key, callback);
    }
  }
  track(key: string, data?: any, metricValue?: number): void {
    return this._wrappedClient.track(key, data, metricValue);
  }
  allFlags(): LDFlagSet {
    return this._wrappedClient.allFlags();
  }
  close(onDone?: () => void): Promise<void> {
    return this.close().then(() => {
      if (typeof onDone === 'function') {
        onDone();
        return undefined;
      }
      return Promise.resolve();
    });
  }
  addHook(_contexthook: Hook): void {
    throw new Error('Not implemented');
  }
  waitUntilGoalsReady(): Promise<void> {
    throw new Error('Not implemented');
  }
}
