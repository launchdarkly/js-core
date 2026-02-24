import type {
  ConnectionMode,
  LDContext,
  LDContextStrict,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import type { LDClientBridge } from '../bridge/LDClientBridge';
import type { LDRendererClient } from './LDRendererClient';

export class ElectronRendererClient implements LDRendererClient {
  private readonly _ldClientBridge: LDClientBridge;

  // Keep a set of callback handles to support closing this client.
  private readonly _callbacks: Set<string> = new Set();

  constructor(clientSideId: string) {
    this._ldClientBridge = (globalThis.window as any)?.ldClientBridge?.(
      clientSideId,
    ) as LDClientBridge;
    if (!this._ldClientBridge) {
      throw new Error(
        'ElectronRendererClient must be used within an Electron renderer process with an available LDClientBridge',
      );
    }
  }

  allFlags(): LDFlagSet {
    return this._ldClientBridge.allFlags();
  }

  boolVariation(key: string, defaultValue: boolean): boolean {
    return this._ldClientBridge.boolVariation(key, defaultValue);
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    return this._ldClientBridge.boolVariationDetail(key, defaultValue);
  }

  flush(): Promise<{ error?: Error; result: boolean }> {
    return this._ldClientBridge.flush();
  }

  waitForInitialization(
    options?: LDWaitForInitializationOptions,
  ): Promise<LDWaitForInitializationResult> {
    return this._ldClientBridge.waitForInitialization(options);
  }

  getContext(): LDContextStrict | undefined {
    return this._ldClientBridge.getContext();
  }

  identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<LDIdentifyResult> {
    return this._ldClientBridge.identify(context, identifyOptions);
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this._ldClientBridge.jsonVariation(key, defaultValue);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this._ldClientBridge.jsonVariationDetail(key, defaultValue);
  }

  off(handle: string): void {
    if (this._callbacks.has(handle) && this._ldClientBridge.removeEventHandler(handle)) {
      this._callbacks.delete(handle);
    }
  }

  on(key: string, callback: (...args: any[]) => void): string {
    // Use an initialized variable so onClose never reads an uninitialized binding. If the bridge
    // invokes onClose synchronously during addEventHandler (e.g. immediate remote port close),
    // callbackId would otherwise be in the temporal dead zone and throw ReferenceError.
    let callbackId: string | undefined;
    const onClose = () => {
      if (callbackId !== undefined) {
        this._callbacks.delete(callbackId);
      }
    };
    callbackId = this._ldClientBridge.addEventHandler(key, callback, onClose);
    this._callbacks.add(callbackId);
    return callbackId;
  }

  numberVariation(key: string, defaultValue: number): number {
    return this._ldClientBridge.numberVariation(key, defaultValue);
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    return this._ldClientBridge.numberVariationDetail(key, defaultValue);
  }

  stringVariation(key: string, defaultValue: string): string {
    return this._ldClientBridge.stringVariation(key, defaultValue);
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    return this._ldClientBridge.stringVariationDetail(key, defaultValue);
  }

  track(key: string, data?: any, metricValue?: number): void {
    return this._ldClientBridge.track(key, data, metricValue);
  }

  variation(key: string, defaultValue?: LDFlagValue) {
    return this._ldClientBridge.variation(key, defaultValue);
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this._ldClientBridge.variationDetail(key, defaultValue);
  }

  setConnectionMode(mode: ConnectionMode): Promise<void> {
    return this._ldClientBridge.setConnectionMode(mode);
  }

  getConnectionMode(): ConnectionMode {
    return this._ldClientBridge.getConnectionMode();
  }

  isOffline(): boolean {
    return this._ldClientBridge.isOffline();
  }

  async close(): Promise<void> {
    const callbacks = Array.from(this._callbacks);
    callbacks.forEach((callbackId) => this.off(callbackId));
  }
}
