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

// Create a helper type for the variation methods
type VariationMethod<T> = (key: string, defaultValue: T) => T;

// Create a helper type for the variation detail methods
type VariationDetailMethod<T> = (key: string, defaultValue: T) => LDEvaluationDetailTyped<T>;

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

  private createVariation<T>(
    key: string,
    defaultValue: T,
    serverMethod: (key: string, context: LDContext, defaultValue: T) => Promise<T>,
  ): T {
    serverMethod(key, this._ldContext, defaultValue).then(/* ignore */);

    return this._bootstrap[key] ?? defaultValue;
  }

  private createVariationDetail<T>(
    key: string,
    defaultValue: T,
    serverMethod: (
      key: string,
      context: LDContext,
      defaultValue: T,
    ) => Promise<LDEvaluationDetailTyped<T>>,
  ): LDEvaluationDetailTyped<T> {
    serverMethod(key, this._ldContext, defaultValue).then(/* ignore */);
    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }

  boolVariation: VariationMethod<boolean> = (key, defaultValue) =>
    this.createVariation(key, defaultValue, global.nodeSdk.boolVariation.bind(global.nodeSdk));

  stringVariation: VariationMethod<string> = (key, defaultValue) =>
    this.createVariation(key, defaultValue, global.nodeSdk.stringVariation.bind(global.nodeSdk));

  numberVariation: VariationMethod<number> = (key, defaultValue) =>
    this.createVariation(key, defaultValue, global.nodeSdk.numberVariation.bind(global.nodeSdk));

  jsonVariation: VariationMethod<unknown> = (key, defaultValue) =>
    this.createVariation(key, defaultValue, global.nodeSdk.jsonVariation.bind(global.nodeSdk));

  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue {
    if (isServer) {
      global.nodeSdk.variation(key, this._ldContext, defaultValue).then(/* ignore */);
    }
    return this._bootstrap[key] ?? defaultValue;
  }

  boolVariationDetail: VariationDetailMethod<boolean> = (key, defaultValue) =>
    this.createVariationDetail(
      key,
      defaultValue,
      global.nodeSdk.boolVariationDetail.bind(global.nodeSdk),
    );

  stringVariationDetail: VariationDetailMethod<string> = (key, defaultValue) =>
    this.createVariationDetail(
      key,
      defaultValue,
      global.nodeSdk.stringVariationDetail.bind(global.nodeSdk),
    );

  numberVariationDetail: VariationDetailMethod<number> = (key, defaultValue) =>
    this.createVariationDetail(
      key,
      defaultValue,
      global.nodeSdk.numberVariationDetail.bind(global.nodeSdk),
    );

  jsonVariationDetail: VariationDetailMethod<unknown> = (key, defaultValue) =>
    this.createVariationDetail(
      key,
      defaultValue,
      global.nodeSdk.jsonVariationDetail.bind(global.nodeSdk),
    );

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    if (isServer) {
      global.nodeSdk.variationDetail(key, this._ldContext, defaultValue).then(/* ignore */);
    }

    const { reason, variation: variationIndex } = this._bootstrap.$flagsState[key];
    return { value: this._bootstrap[key], reason, variationIndex };
  }
}
