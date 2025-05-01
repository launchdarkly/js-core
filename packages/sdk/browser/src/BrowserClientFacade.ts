import {
  Hook,
  LDContext,
  LDEmitterEventName,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyResult,
  LDLogger,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserClient } from './BrowserClient';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { LDClient } from './LDClient';

// This is a factory function that creates a pointer-to-implementation wrapper around the BrowserClient class.
// It allows us to completely hide the implementation details of the BrowserClient class from the public API.
// Additionally it allows us to make changes to API which wouldn't be backward compatible with the 10.x version of the
// react-native SDK.

// This uses a factory method instead of a class to avoid exposing private members. In typescript private members are
// not in the types, but they are still accessible. In JS, without type annotations, it is easy to use what are
// intended to be private implementation details.

export function createBrowserClientFacade(client: BrowserClient): LDClient {
  return {
    get logger(): LDLogger {
      return client.logger;
    },

    async identify(
      context: LDContext,
      identifyOptions?: LDIdentifyOptions,
    ): Promise<LDIdentifyResult> {
      // The facade changes the public API of identify to match the identifyResult API of the common implementation.
      // This is so that its API can cleanly expose only the new functionality.
      return client.identifyResult(context, identifyOptions);
    },

    allFlags(): LDFlagSet {
      return client.allFlags();
    },

    boolVariation(key: string, defaultValue: boolean): boolean {
      return client.boolVariation(key, defaultValue);
    },

    boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
      return client.boolVariationDetail(key, defaultValue);
    },

    close(): Promise<void> {
      return client.close();
    },

    flush(): Promise<{ error?: Error; result: boolean }> {
      return client.flush();
    },

    getContext(): LDContext | undefined {
      return client.getContext();
    },

    jsonVariation(key: string, defaultValue: unknown): unknown {
      return client.jsonVariation(key, defaultValue);
    },

    jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
      return client.jsonVariationDetail(key, defaultValue);
    },

    numberVariation(key: string, defaultValue: number): number {
      return client.numberVariation(key, defaultValue);
    },

    numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
      return client.numberVariationDetail(key, defaultValue);
    },

    off(key: string, callback: (...args: any[]) => void): void {
      return client.off(key as LDEmitterEventName, callback);
    },

    on(key: string, callback: (...args: any[]) => void): void {
      return client.on(key as LDEmitterEventName, callback);
    },

    stringVariation(key: string, defaultValue: string): string {
      return client.stringVariation(key, defaultValue);
    },

    stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
      return client.stringVariationDetail(key, defaultValue);
    },

    track(key: string, data?: any, metricValue?: number): void {
      return client.track(key, data, metricValue);
    },

    variation(key: string, defaultValue?: LDFlagValue) {
      return client.variation(key, defaultValue);
    },

    variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
      return client.variationDetail(key, defaultValue);
    },

    addHook(hook: Hook): void {
      return client.addHook(hook);
    },

    setStreaming(streaming?: boolean): void {
      return client.setStreaming(streaming);
    },
  };
}
