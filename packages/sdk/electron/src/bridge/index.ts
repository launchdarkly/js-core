import { contextBridge, ipcRenderer } from 'electron';

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

import type { ElectronIdentifyOptions } from '../ElectronIdentifyOptions';
import type { LDClientBridge } from './LDClientBridge';

const generateCallbackId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`.toUpperCase();

const ldClientBridge = (clientSideId: string): LDClientBridge => {
  const getEventName = (baseName: string) => `ld:${clientSideId}:${baseName}`;
  return {
    allFlags: (): LDFlagSet => ipcRenderer.sendSync(getEventName('allFlags')),

    boolVariation: (key: string, defaultValue: boolean): boolean =>
      ipcRenderer.sendSync(getEventName('boolVariation'), key, defaultValue),

    boolVariationDetail: (key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> =>
      ipcRenderer.sendSync(getEventName('boolVariationDetail'), key, defaultValue),

    // I don't think we should allow flush to be called from the renderer process.
    flush: (): Promise<{ error?: Error; result: boolean }> =>
      ipcRenderer.invoke(getEventName('flush')),

    getContext: (): LDContextStrict | undefined => ipcRenderer.sendSync(getEventName('getContext')),

    identify: (
      context: LDContext,
      identifyOptions?: ElectronIdentifyOptions,
    ): Promise<LDIdentifyResult> =>
      ipcRenderer.invoke(getEventName('identify'), context, identifyOptions),

    jsonVariation: (key: string, defaultValue: unknown): unknown =>
      ipcRenderer.sendSync(getEventName('jsonVariation'), key, defaultValue),

    jsonVariationDetail: (key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> =>
      ipcRenderer.sendSync(getEventName('jsonVariationDetail'), key, defaultValue),

    waitForInitialization: (
      options?: LDWaitForInitializationOptions,
    ): Promise<LDWaitForInitializationResult> =>
      ipcRenderer.invoke(getEventName('waitForInitialization'), options),

    numberVariation: (key: string, defaultValue: number): number =>
      ipcRenderer.sendSync(getEventName('numberVariation'), key, defaultValue),

    numberVariationDetail: (key: string, defaultValue: number): LDEvaluationDetailTyped<number> =>
      ipcRenderer.sendSync(getEventName('numberVariationDetail'), key, defaultValue),

    stringVariation: (key: string, defaultValue: string): string =>
      ipcRenderer.sendSync(getEventName('stringVariation'), key, defaultValue),

    stringVariationDetail: (key: string, defaultValue: string): LDEvaluationDetailTyped<string> =>
      ipcRenderer.sendSync(getEventName('stringVariationDetail'), key, defaultValue),

    track: (key: string, data?: any, metricValue?: number): void =>
      ipcRenderer.sendSync(getEventName('track'), key, data, metricValue),

    variation: (key: string, defaultValue?: LDFlagValue): LDFlagValue =>
      ipcRenderer.sendSync(getEventName('variation'), key, defaultValue),

    variationDetail: (key: string, defaultValue?: LDFlagValue): LDEvaluationDetail =>
      ipcRenderer.sendSync(getEventName('variationDetail'), key, defaultValue),

    setConnectionMode: (mode: ConnectionMode): Promise<void> =>
      ipcRenderer.invoke(getEventName('setConnectionMode'), mode),

    getConnectionMode: (): ConnectionMode =>
      ipcRenderer.sendSync(getEventName('getConnectionMode')),

    isOffline: (): boolean => ipcRenderer.sendSync(getEventName('isOffline')),

    /**
     * Subscribes to an SDK event from the renderer. The callback is invoked in the renderer when
     * the main process emits that event. Uses a MessageChannel: port2 is transferred to main so
     * it can postMessage event args back; port1 stays here and runs the user callback on message.
     */
    addEventHandler: (eventName: string, callback: (...args: any[]) => void): string => {
      // Creates an ID for the callback so we can keep track of it.
      const callbackId = generateCallbackId();
      const { port1, port2 } = new MessageChannel();
      ipcRenderer.postMessage(getEventName('addEventHandler'), { eventName, callbackId }, [port2]);
      port1.onmessage = (event) => callback(...event.data);
      return callbackId;
    },

    /**
     * Unregisters the handler identified by callbackId in the main process. Returns whether removal
     * succeeded. Synchronous so the renderer can rely on the handler being removed before the next event.
     */
    removeEventHandler: (eventName: string, callbackId: string): boolean =>
      ipcRenderer.sendSync(getEventName('removeEventHandler'), eventName, callbackId),
  };
};

contextBridge.exposeInMainWorld('ldClientBridge', ldClientBridge);
