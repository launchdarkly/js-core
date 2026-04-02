import type { LDFlagValue } from '@launchdarkly/js-client-sdk-common';

const TRUE_VARIATION_INDEX = 0;
const FALSE_VARIATION_INDEX = 1;

interface BuilderData {
  on: boolean;
  variations: LDFlagValue[];
  offVariation?: number;
  fallthroughVariation?: number;
}

function variationForBoolean(value: boolean): number {
  return value ? TRUE_VARIATION_INDEX : FALSE_VARIATION_INDEX;
}

/**
 * A builder for feature flag configurations to be used with {@link TestData}.
 *
 * The shape mirrors `@launchdarkly/js-server-sdk-common`'s server-side
 * TestDataFlagBuilder so users moving between client and server SDKs see a
 * familiar API. Unlike the server-side builder, this one produces a single
 * pre-evaluated value because client-side SDKs do not evaluate rules locally.
 */
export default class TestDataFlagBuilder {
  private _data: BuilderData = {
    on: true,
    variations: [],
  };

  /**
   * @internal
   */
  constructor(
    private readonly _key: string,
    data?: BuilderData,
  ) {
    if (data) {
      this._data = {
        on: data.on,
        variations: [...data.variations],
        offVariation: data.offVariation,
        fallthroughVariation: data.fallthroughVariation,
      };
    }
  }

  private get _isBooleanFlag(): boolean {
    return (
      this._data.variations.length === 2 &&
      this._data.variations[TRUE_VARIATION_INDEX] === true &&
      this._data.variations[FALSE_VARIATION_INDEX] === false
    );
  }

  /**
   * A shortcut for setting the flag to use the standard boolean configuration.
   *
   * This is the default for all new flags created with {@link TestData.flag}. The
   * flag will have two variations, `true` and `false` (in that order). It will
   * return `false` whenever targeting is off and `true` when targeting is on
   * unless other settings specify otherwise.
   *
   * @returns the flag builder
   */
  booleanFlag(): TestDataFlagBuilder {
    if (this._isBooleanFlag) {
      return this;
    }
    return this.variations(true, false)
      .fallthroughVariation(TRUE_VARIATION_INDEX)
      .offVariation(FALSE_VARIATION_INDEX);
  }

  /**
   * A shortcut for setting the flag to serve a single string value to all contexts.
   *
   * The flag will have one variation, `value`, used for both the fallthrough and
   * off states. Targeting state (`on`) is preserved so chaining `on(false)` after
   * this call still resolves to `value`.
   *
   * @param value the string value to serve
   * @returns the flag builder
   */
  stringFlag(value: string): TestDataFlagBuilder {
    return this.variations(value).fallthroughVariation(0).offVariation(0);
  }

  /**
   * A shortcut for setting the flag to serve a single numeric value to all contexts.
   *
   * The flag will have one variation, `value`, used for both the fallthrough and
   * off states. Targeting state (`on`) is preserved so chaining `on(false)` after
   * this call still resolves to `value`.
   *
   * @param value the numeric value to serve
   * @returns the flag builder
   */
  numberFlag(value: number): TestDataFlagBuilder {
    return this.variations(value).fallthroughVariation(0).offVariation(0);
  }

  /**
   * A shortcut for setting the flag to serve a single JSON value (object or array)
   * to all contexts.
   *
   * The flag will have one variation, `value`, used for both the fallthrough and
   * off states. Targeting state (`on`) is preserved so chaining `on(false)` after
   * this call still resolves to `value`.
   *
   * @param value the JSON object or array to serve
   * @returns the flag builder
   */
  jsonFlag(value: object | unknown[]): TestDataFlagBuilder {
    return this.variations(value).fallthroughVariation(0).offVariation(0);
  }

  /**
   * Sets the allowable variation values for the flag.
   *
   * @param values any number of variation values
   * @returns the flag builder
   */
  variations(...values: LDFlagValue[]): TestDataFlagBuilder {
    this._data.variations = [...values];
    return this;
  }

  /**
   * Sets targeting to be on or off for this flag.
   *
   * @param targetingOn true if targeting should be on
   * @returns the flag builder
   */
  on(targetingOn: boolean): TestDataFlagBuilder {
    this._data.on = targetingOn;
    return this;
  }

  /**
   * Specifies the fallthrough variation for a flag. The fallthrough is the value
   * that is returned if targeting is on.
   *
   * If a boolean is supplied, and the flag was previously configured with other
   * variations, this also changes it to a boolean flag.
   *
   * @param variation either `true` or `false` or the index of the desired variation
   * @returns the flag builder
   */
  fallthroughVariation(variation: number | boolean): TestDataFlagBuilder {
    if (typeof variation === 'boolean') {
      return this.booleanFlag().fallthroughVariation(variationForBoolean(variation));
    }
    this._data.fallthroughVariation = variation;
    return this;
  }

  /**
   * Specifies the off variation for a flag. This is the variation that is
   * returned whenever targeting is off.
   *
   * If a boolean is supplied, and the flag was previously configured with other
   * variations, this also changes it to a boolean flag.
   *
   * @param variation either `true` or `false` or the index of the desired variation
   * @returns the flag builder
   */
  offVariation(variation: number | boolean): TestDataFlagBuilder {
    if (typeof variation === 'boolean') {
      return this.booleanFlag().offVariation(variationForBoolean(variation));
    }
    this._data.offVariation = variation;
    return this;
  }

  /**
   * Sets the flag to always return the specified variation for all contexts.
   *
   * Targeting is switched on, and the fallthrough variation is set to the
   * specified value.
   *
   * If a boolean is supplied, and the flag was previously configured with other
   * variations, this also changes it to a boolean flag.
   *
   * @param variation either `true` or `false` or the index of the desired variation
   * @returns the flag builder
   */
  variationForAll(variation: number | boolean): TestDataFlagBuilder {
    return this.on(true).fallthroughVariation(variation);
  }

  /**
   * Sets the flag to always return the specified variation value for all contexts.
   *
   * The value may be of any valid JSON type. This method changes the flag to have
   * only a single variation, which is this value, and to return the same variation
   * regardless of whether targeting is on or off.
   *
   * @param value The desired value to be returned for all contexts.
   * @returns the flag builder
   */
  valueForAll(value: LDFlagValue): TestDataFlagBuilder {
    return this.variations(value).fallthroughVariation(0).offVariation(0);
  }

  /**
   * Resolves the current builder state to a flag value.
   *
   * @internal
   */
  resolve(): LDFlagValue {
    const variationIndex = this._data.on
      ? this._data.fallthroughVariation
      : this._data.offVariation;

    if (variationIndex === undefined) {
      throw new Error(
        `TestData flag "${this._key}" has no ${this._data.on ? 'fallthrough' : 'off'} variation configured`,
      );
    }
    if (variationIndex < 0 || variationIndex >= this._data.variations.length) {
      throw new Error(
        `TestData flag "${this._key}" variation index ${variationIndex} is out of bounds for ${this._data.variations.length} variation(s)`,
      );
    }
    return this._data.variations[variationIndex];
  }

  /**
   * @internal
   */
  clone(): TestDataFlagBuilder {
    return new TestDataFlagBuilder(this._key, this._data);
  }

  /**
   * @internal
   */
  getKey(): string {
    return this._key;
  }
}
