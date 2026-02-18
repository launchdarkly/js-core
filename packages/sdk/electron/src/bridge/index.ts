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
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

import { getIPCChannelName } from '../ElectronIPC';
import type { LDClientBridge, LDMessagePort } from './LDClientBridge';

const generateCallbackId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`.toUpperCase();

const ldClientBridge = (namespace: string): LDClientBridge => ({
  allFlags: (): LDFlagSet => ipcRenderer.sendSync(getIPCChannelName(namespace, 'allFlags')),

  boolVariation: (key: string, defaultValue: boolean): boolean =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'boolVariation'), key, defaultValue),

  boolVariationDetail: (key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'boolVariationDetail'), key, defaultValue),

  // Flush is exposed so the renderer can request a flush; the main process performs the actual flush.
  flush: (): Promise<{ error?: Error; result: boolean }> =>
    ipcRenderer.invoke(getIPCChannelName(namespace, 'flush')),

  getContext: (): LDContextStrict | undefined =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'getContext')),

  identify: (
    context: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> =>
    ipcRenderer.invoke(getIPCChannelName(namespace, 'identify'), context, identifyOptions),

  jsonVariation: (key: string, defaultValue: unknown): unknown =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'jsonVariation'), key, defaultValue),

  jsonVariationDetail: (key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'jsonVariationDetail'), key, defaultValue),

  waitForInitialization: (
    options?: LDWaitForInitializationOptions,
  ): Promise<LDWaitForInitializationResult> =>
    ipcRenderer.invoke(getIPCChannelName(namespace, 'waitForInitialization'), options),

  numberVariation: (key: string, defaultValue: number): number =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'numberVariation'), key, defaultValue),

  numberVariationDetail: (key: string, defaultValue: number): LDEvaluationDetailTyped<number> =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'numberVariationDetail'), key, defaultValue),

  stringVariation: (key: string, defaultValue: string): string =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'stringVariation'), key, defaultValue),

  stringVariationDetail: (key: string, defaultValue: string): LDEvaluationDetailTyped<string> =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'stringVariationDetail'), key, defaultValue),

  track: (key: string, data?: any, metricValue?: number): void =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'track'), key, data, metricValue),

  variation: (key: string, defaultValue?: LDFlagValue): LDFlagValue =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'variation'), key, defaultValue),

  variationDetail: (key: string, defaultValue?: LDFlagValue): LDEvaluationDetail =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'variationDetail'), key, defaultValue),

  setConnectionMode: (mode: ConnectionMode): Promise<void> =>
    ipcRenderer.invoke(getIPCChannelName(namespace, 'setConnectionMode'), mode),

  getConnectionMode: (): ConnectionMode =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'getConnectionMode')),

  isOffline: (): boolean => ipcRenderer.sendSync(getIPCChannelName(namespace, 'isOffline')),

  /**
   * Subscribes to an SDK event from the renderer. The callback is invoked in the renderer when
   * the main process emits that event. Uses a MessageChannel: port2 is transferred to main so
   * it can postMessage event args back; port1 stays here and runs the user callback on message.
   */
  addEventHandler: (
    eventName: string,
    callback: (...args: any[]) => void,
    onClose?: () => void,
  ): string => {
    // Creates an ID for the callback so we can keep track of it.
    const callbackId = generateCallbackId();
    const { port1, port2 } = new MessageChannel();
    ipcRenderer.postMessage(
      getIPCChannelName(namespace, 'addEventHandler'),
      { eventName, callbackId },
      [port2],
    );
    port1.onmessage = (event) => callback(...event.data);
    (port1 as LDMessagePort).onclose = () => onClose?.();
    return callbackId;
  },

  /**
   * Unregisters the handler identified by callbackId in the main process. Returns whether removal
   * succeeded. Synchronous so the renderer can rely on the handler being removed before the next event.
   */
  removeEventHandler: (callbackId: string): boolean =>
    ipcRenderer.sendSync(getIPCChannelName(namespace, 'removeEventHandler'), callbackId),
});

contextBridge.exposeInMainWorld('ldClientBridge', ldClientBridge);
