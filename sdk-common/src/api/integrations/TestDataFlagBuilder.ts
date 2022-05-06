import { TestDataRuleBuilder } from './TestDataRuleBuilder';

/**
 * A builder for feature flag configurations to be used with [[TestData]].
 */

export interface TestDataFlagBuilder {
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
  booleanFlag(): TestDataFlagBuilder;

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
  variations(...values: any[]): TestDataFlagBuilder;

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
  on(targetingOn: boolean): TestDataFlagBuilder;

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
  fallthroughVariation(variation: boolean | number): TestDataFlagBuilder;

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
  offVariation(variation: boolean | number): TestDataFlagBuilder;

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
  variationForAll(variation: boolean | number): TestDataFlagBuilder;

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
  valueForAll(value: any): TestDataFlagBuilder;

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
  variationForUser(contextKey: string, variation: boolean | number): TestDataFlagBuilder;

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
  variationForContext(contextKind: string, contextKey: string, variation: boolean | number): TestDataFlagBuilder;

  /**
   * Removes any existing rules from the flag. This undoes the effect of methods
   * like [[ifMatch]].
   *
   * @return the same flag builder
   */
  clearRules(): TestDataFlagBuilder;

  /**
   * Removes any existing targets from the flag. This undoes the effect of
   * methods like [[variationForContext]].
   *
   * @return the same flag builder
   */
  clearAlltargets(): TestDataFlagBuilder;

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
  ifMatch(contextKind: string, attribute: string, ...values: any): TestDataRuleBuilder;

  /**
   * Starts defining a flag rule using the "is not one of" operator.
   *
   * For example, this creates a rule that returnes `true` if the name is
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
  ifNotMatch(contextKind: string, attribute: string, ...values: any): TestDataRuleBuilder;
}
