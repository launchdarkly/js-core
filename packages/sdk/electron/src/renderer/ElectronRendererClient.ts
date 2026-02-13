import type {
  ConnectionMode,
  LDContext,
  LDContextStrict,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyResult,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import type { LDClientBridge } from '../bridge/LDClientBridge';
import type { ElectronIdentifyOptions } from '../ElectronIdentifyOptions';
import type { LDRendererClient } from './LDRendererClient';

export class ElectronRendererClient implements LDRendererClient {
  private readonly _ldClientBridge: LDClientBridge;
  
  // Map of callback to event name to an array of callback ids.
  // The reason for this is that we remove a listener using the callback reference,
  // however, we need to know which event name to remove the listener from for it to be
  // meaningful to the main process.
  //
  // There is also a scenario where the same callback is added to the same event name
  // multiple times. For those cases, we need to keep track of all the callback ids for the same event name.
  private readonly _callbacks: Map<Function, Map<string, string[]>> = new Map();

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

  identify(
    context: LDContext,
    identifyOptions?: ElectronIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    return this._ldClientBridge.identify(context, identifyOptions);
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this._ldClientBridge.jsonVariation(key, defaultValue);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this._ldClientBridge.jsonVariationDetail(key, defaultValue);
  }

  off(key: string, callback: (...args: any[]) => void): void {
    const callbackIds = this._callbacks.get(callback)?.get(key);
    if (callbackIds && callbackIds.length) {
      const lastId = callbackIds[callbackIds.length - 1];
      if (this._ldClientBridge.removeEventHandler(key, lastId)) {
        callbackIds.pop();
      }
    }
  }

  on(key: string, callback: (...args: any[]) => void): void {
    const callbackId = this._ldClientBridge.addEventHandler(key, callback);
    let callbackEvents = this._callbacks.get(callback);
    if (!callbackEvents) {
      callbackEvents = new Map();
      this._callbacks.set(callback, callbackEvents);
    }

    const callbackIds = callbackEvents.get(key);
    if (!callbackIds) {
      callbackEvents.set(key, [callbackId]);
    } else {
      callbackIds.push(callbackId);
    }
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
}
