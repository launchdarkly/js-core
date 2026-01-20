import { contextBridge, ipcRenderer } from 'electron';

import type {
  ConnectionMode,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

import type { LDClientBridge } from './LDClientBridge';

export function registerLDClientBridge() {
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

      flush: (): Promise<{ error?: Error; result: boolean }> =>
        ipcRenderer.invoke(getEventName('flush')),

      getContext: (): LDContext | undefined => ipcRenderer.sendSync(getEventName('getContext')),

      identify: (context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> =>
        ipcRenderer.invoke(getEventName('identify'), context, identifyOptions),

      jsonVariation: (key: string, defaultValue: unknown): unknown =>
        ipcRenderer.sendSync(getEventName('jsonVariation'), key, defaultValue),

      jsonVariationDetail: (key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> =>
        ipcRenderer.sendSync(getEventName('jsonVariationDetail'), key, defaultValue),

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

      addEventHandler: (eventName: string, callback: (...args: any[]) => void): string => {
        const callbackId = generateCallbackId();
        const { port1, port2 } = new MessageChannel();
        ipcRenderer.postMessage(getEventName('addEventHandler'), { eventName, callbackId }, [
          port2,
        ]);
        port1.onmessage = (event) => callback(...event.data);
        port1.addEventListener('close', () =>
          console.log(`RENDERER PORT FOR CALLBACK ${callbackId} CLOSED`),
        );
        return callbackId;
      },

      removeEventHandler: (eventName: string, callbackId: string): boolean =>
        ipcRenderer.sendSync(getEventName('removeEventHandler'), eventName, callbackId),
    };
  };

  contextBridge.exposeInMainWorld('ldClientBridge', ldClientBridge);
}
