import { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';
import type {
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
} from '@launchdarkly/node-server-sdk';

import { isServer } from './isServer';
import type { JSSdk } from './types';

// GOTCHA: Partially implement the js sdk.
// Omit variationDetail because its return type is incompatible with js-core.
type PartialJSSdk = Omit<Partial<JSSdk>, 'variationDetail'>;

/**
 * A partial ldClient suitable for RSC and server side rendering.
 */
export class LDClientRsc implements PartialJSSdk {
  constructor(
    private readonly _ldContext: LDContext,
    private readonly _bootstrap: LDFlagSet,
  ) {}

  allFlags(): LDFlagSet {
    return this._bootstrap;
  }

  getContext(): LDContext {
    return this._ldContext;
  }

  /**
   *
   * Call the server sdk variation for analytics purposes.
   */
  boolVariation(key: string, defaultValue: boolean): boolean {
    if (isServer) {
      global.nodeSdk.boolVariation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  stringVariation(key: string, defaultValue: string): string {
    if (isServer) {
      global.nodeSdk.stringVariation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  numberVariation(key: string, defaultValue: number): number {
    if (isServer) {
      global.nodeSdk.numberVariation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    if (isServer) {
      global.nodeSdk.jsonVariation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue {
    if (isServer) {
      global.nodeSdk.variation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    if (isServer) {
      global.nodeSdk.boolVariationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    if (isServer) {
      global.nodeSdk.stringVariationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    if (isServer) {
      global.nodeSdk.numberVariationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    if (isServer) {
      global.nodeSdk.jsonVariationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    if (isServer) {
      global.nodeSdk.variationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }
}
