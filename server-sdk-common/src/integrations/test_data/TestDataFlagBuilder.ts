import { TypeValidators } from '@launchdarkly/js-sdk-common';
import { Flag } from '../../evaluation/data/Flag';
import { Target } from '../../evaluation/data/Target';
import { TRUE_VARIATION_INDEX, FALSE_VARIATION_INDEX, variationForBoolean } from './booleanVariation';
import TestDataRuleBuilder from './TestDataRuleBuilder';

interface BuilderData {
  on: boolean;
  variations: any[];
  offVariation?: number;
  fallthroughVariation?: number;
  // For a given variation, what are the targets of that variation.
  // Each target being a context kind and a list of keys for that kind.
  targetsByVariation?: Record<number, Record<string, string[]>>;
  rules?: TestDataRuleBuilder<TestDataFlagBuilder>[];
}

/**
 * A builder for feature flag configurations to be used with [[TestData]].
 */
export default class TestDataFlagBuilder {
  private data: BuilderData = {
    on: true,
    variations: [],
  };

  /**
   * @internal
   */
  constructor(private readonly key: string, data?: BuilderData) {
    if (data) {
      // Not the fastest way to deep copy, but this is a testing mechanism.
      this.data = {
        on: data.on,
        variations: [...data.variations],
      };
      if (data.offVariation !== undefined) {
        this.data.offVariation = data.offVariation;
      }
      if (data.fallthroughVariation !== undefined) {
        this.data.offVariation = data.offVariation;
      }
      if (data.targetsByVariation) {
        this.data.targetsByVariation = JSON.parse(JSON.stringify(data.targetsByVariation));
      }
      if (data.rules) {
        this.data.rules = [];
        data.rules.forEach((rule) => {
          this.data.rules?.push(rule.clone());
        });
      }
    }
  }

  private get isBooleanFlag(): boolean {
    return this.data.variations.length === 2
      && this.data.variations[TRUE_VARIATION_INDEX] === true
      && this.data.variations[FALSE_VARIATION_INDEX] === false;
  }

  /**
 * A shortcut for setting the flag to use the standard boolean configuration.
 *
 * This is the default for all new flags created with [[TestData.flag]]. The
 * flag will have two variations, `true` and `false` (in that order). It
 * will return `false` whenever targeting is off and `true` when targeting
 * is on unless other settings specify otherwise.
 *
 * @return the flag builder
 */
  booleanFlag(): TestDataFlagBuilder {
    if (this.isBooleanFlag) {
      return this;
    }
    // Change this flag into a boolean flag.
    return this.variations(true, false)
      .fallthroughVariation(TRUE_VARIATION_INDEX)
      .offVariation(FALSE_VARIATION_INDEX);
  }

  /**
 * Sets the allowable variation values for the flag.
 *
 * The values may be of any JSON-compatible type: boolean, number, string, array,
 * or object. For instance, a boolean flag normally has `variations(true, false)`;
 * a string-valued flag might have `variations("red", "green")`; etc.
 *
 * @param values any number of variation values
 * @return the flag builder
 */
  variations(...values: any[]): TestDataFlagBuilder {
    this.data.variations = [...values];
    return this;
  }

  /**
   * Sets targeting to be on or off for this flag.
   *
   * The effect of this depends on the rest of the flag configuration, just
   * as it does on the real LaunchDarkly dashboard. In the default configuration
   * that you get from calling [[TestData.flag]] with a new flag key, the flag
   * will return `false` whenever targeting is off and `true` when targeting
   * is on.
   *
   * @param targetingOn true if targeting should be on
   * @return the flag builder
   */
  on(targetingOn: boolean): TestDataFlagBuilder {
    this.data.on = targetingOn;
    return this;
  }

  /**
   * Specifies the fallthrough variation for a flag. The fallthrough is
   * the value that is returned if targeting is on and the user was not
   * matched by a more specific target or rule.
   *
   * If a boolean is supplied, and the flag was previously configured with
   * other variations, this also changes it to a boolean flag.
   *
   * @param variation
   *    either `true` or `false` or the index of the desired fallthrough
   *    variation: 0 for the first, 1 for the second, etc.
   * @return the flag builder
   */
  fallthroughVariation(variation: number | boolean): TestDataFlagBuilder {
    if (TypeValidators.Boolean.is(variation)) {
      return this.booleanFlag().fallthroughVariation(variationForBoolean(variation));
    }
    this.data.fallthroughVariation = variation;
    return this;
  }

  /**
   * Specifies the off variation for a flag. This is the variation that is
   * returned whenever targeting is off.
   *
   * If a boolean is supplied, and the flag was previously configured with
   * other variations, this also changes it to a boolean flag.
   *
   * @param variation
   *    either `true` or `false` or the index of the desired off
   *    variation: 0 for the first, 1 for the second, etc.
   * @return the flag builder
   */
  offVariation(variation: number | boolean): TestDataFlagBuilder {
    if (TypeValidators.Boolean.is(variation)) {
      return this.booleanFlag().offVariation(variationForBoolean(variation));
    }
    this.data.offVariation = variation;
    return this;
  }

  /**
   * Sets the flag to always return the specified variation for all contexts.
   *
   * Targeting is switched on, any existing targets or rules are removed,
   * and the fallthrough variation is set to the specified value. The off
   * variation is left unchanged.
   *
   * If a boolean is supplied, and the flag was previously configured with
   * other variations, this also changes it to a boolean flag.
   *
   * @param varation
   *    either `true` or `false` or the index of the desired variation:
   *    0 for the first, 1 for the second, etc.
   * @return the flag builder
   */
  variationForAll(variation: number | boolean): TestDataFlagBuilder {
    return this.on(true).clearRules().clearAllTargets().fallthroughVariation(variation);
  }

  /**
   * Sets the flag to always return the specified variation value for all contexts.
   *
   * The value may be of any valid JSON type. This method changes the flag to have
   * only a single variation, which is this value, and to return the same variation
   * regardless of whether targeting is on or off. Any existing targets or rules
   * are removed.
   *
   * @param value The desired value to be returned for all contexts.
   * @return the flag builder
   */
  valueForAll(value: any): TestDataFlagBuilder {
    return this.variations(value).variationForAll(0);
  }

  /**
   * Sets the flag to return the specified variation for a specific context key
   * when targeting is on. The context kind for contexts created with this method
   * will be 'user'.
   *
   * This has no effect when targeting is turned off for the flag.
   *
   * If the variation is a boolean value and the flag was not already a boolean
   * flag, this also changes it to be a boolean flag.
   *
   * If the variation is an integer, it specifies a variation out of whatever
   * variation values have already been defined.
   *
   * @param contextKey a context key
   * @param variation
   *    either `true` or `false` or the index of the desired variation:
   *    0 for the first, 1 for the second, etc.
   * @return the flag builder
   */
  variationForUser(contextKey: string, variation: number | boolean): TestDataFlagBuilder {
    return this.variationForContext('user', contextKey, variation);
  }

  /**
   * Sets the flag to return the specified variation for a specific context key
   * when targeting is on.
   *
   * This has no effect when targeting is turned off for the flag.
   *
   * If the variation is a boolean value and the flag was not already a boolean
   * flag, this also changes it to be a boolean flag.
   *
   * If the variation is an integer, it specifies a variation out of whatever
   * variation values have already been defined.
   *
   * @param contextKind a context kind
   * @param contextKey a context key
   * @param variation
   *    either `true` or `false` or the index of the desired variation:
   *    0 for the first, 1 for the second, etc.
   * @return the flag builder
   */
  variationForContext(
    contextKind: string,
    contextKey: string,
    variation: number | boolean,
  ): TestDataFlagBuilder {
    if (TypeValidators.Boolean.is(variation)) {
      return this.booleanFlag()
        .variationForContext(contextKind, contextKey, variationForBoolean(variation));
    }

    if (!this.data.targetsByVariation) {
      this.data.targetsByVariation = {};
    }

    this.data.variations.forEach((_, i) => {
      if (i === variation) {
        // If there is nothing set at the current variation then set it to the empty array
        const targetsForVariation = this.data.targetsByVariation![i] || {};

        if (!(contextKind in targetsForVariation)) {
          targetsForVariation[contextKind] = [];
        }
        const exists = targetsForVariation[contextKind].indexOf(contextKey) !== -1;
        // Add context to current variation set if they aren't already there
        if (!exists) {
          targetsForVariation[contextKind].push(contextKey);
        }

        this.data.targetsByVariation![i] = targetsForVariation;
      } else {
        // remove user from other variation set if necessary
        const targetsForVariation = this.data.targetsByVariation![i];
        if (targetsForVariation) {
          const targetsForContextKind = targetsForVariation[contextKind];
          if (targetsForContextKind) {
            const targetIndex = targetsForContextKind.indexOf(contextKey);
            if (targetIndex !== -1) {
              targetsForContextKind.splice(targetIndex, 1);
              if (!targetsForContextKind.length) {
                delete targetsForVariation[contextKind];
              }
            }
          }
          if (!Object.keys(targetsForVariation).length) {
            delete this.data.targetsByVariation![i];
          }
        }
      }
    });

    return this;
  }

  /**
   * Removes any existing rules from the flag. This undoes the effect of methods
   * like [[ifMatch]].
   *
   * @return the same flag builder
   */
  clearRules(): TestDataFlagBuilder {
    delete this.data.rules;
    return this;
  }

  /**
   * Removes any existing targets from the flag. This undoes the effect of
   * methods like [[variationForContext]].
   *
   * @return the same flag builder
   */
  clearAllTargets(): TestDataFlagBuilder {
    delete this.data.targetsByVariation;
    return this;
  }

  /**
   * Starts defining a flag rule using the "is one of" operator.
   *
   * For example, this creates a rule that returnes `true` if the name is
   * "Patsy" or "Edina":
   *
   *     testData.flag('flag')
   *             .ifMatch('user', name', 'Patsy', 'Edina')
   *             .thenReturn(true)
   *
   * @param contextKind the kind of the context
   * @param attribute the context attribute to match against
   * @param values values to compare to
   * @return
   *    a flag rule builder; call `thenReturn` to finish the rule
   *    or add more tests with another method like `andMatch`
   */
  ifMatch(
    contextKind: string,
    attribute: string,
    ...values: any
  ): TestDataRuleBuilder<TestDataFlagBuilder> {
    const flagRuleBuilder = new TestDataRuleBuilder(this);
    return flagRuleBuilder.andMatch(contextKind, attribute, ...values);
  }

  /**
   * Starts defining a flag rule using the "is not one of" operator.
   *
   * For example, this creates a rule that returns `true` if the name is
   * neither "Saffron" nor "Bubble":
   *
   *     testData.flag('flag')
   *             .ifNotMatch('user', 'name', 'Saffron', 'Bubble')
   *             .thenReturn(true)
   *
   * @param contextKind the kind of the context
   * @param attribute the user attribute to match against
   * @param values values to compare to
   * @return
   *    a flag rule builder; call `thenReturn` to finish the rule
   *    or add more tests with another method like `andNotMatch`
   */
  ifNotMatch(
    contextKind: string,
    attribute: string,
    ...values: any
  ): TestDataRuleBuilder<TestDataFlagBuilder> {
    const flagRuleBuilder = new TestDataRuleBuilder<TestDataFlagBuilder>(this);
    return flagRuleBuilder.andNotMatch(contextKind, attribute, ...values);
  }

  /**
   * @internal
   */
  addRule(flagRuleBuilder: TestDataRuleBuilder<TestDataFlagBuilder>) {
    if (!this.data.rules) {
      this.data.rules = [];
    }
    this.data.rules.push(flagRuleBuilder as TestDataRuleBuilder<TestDataFlagBuilder>);
  }

  /**
   * @internal
   */
  build(version: number) {
    const baseFlagObject: Flag = {
      key: this.key,
      version,
      on: this.data.on,
      offVariation: this.data.offVariation,
      fallthrough: {
        variation: this.data.fallthroughVariation,
      },
      variations: [...this.data.variations],
    };

    if (this.data.targetsByVariation) {
      const contextTargets: Target[] = [];
      Object.entries(
        this.data.targetsByVariation,
      ).forEach(([variation, contextTargetsForVariation]) => {
        Object.entries(contextTargetsForVariation).forEach(([contextKind, values]) => {
          contextTargets.push({
            contextKind,
            values,
            // Iterating the object it will be a string.
            variation: parseInt(variation, 10),
          });
        });
      });
      baseFlagObject.contextTargets = contextTargets;
    }

    if (this.data.rules) {
      baseFlagObject.rules = this.data.rules.map(
        (rule, i) => (rule as TestDataRuleBuilder<TestDataFlagBuilder>).build(String(i)),
      );
    }

    return baseFlagObject;
  }

  /**
   * @internal
   */
  clone(): TestDataFlagBuilder {
    return new TestDataFlagBuilder(this.key, this.data);
  }

  /**
   * @internal
   */
  getKey(): string {
    return this.key;
  }
}
