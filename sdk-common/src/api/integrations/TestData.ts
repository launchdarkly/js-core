/**
 * A mechanism for providing dynamically updatable feature flag state in a simplified form to an SDK
 * client in test scenarios.
 *
 * Unlike [[FileData]], this mechanism does not use any external resources. It provides only the
 * data that the application has put into it using the [[TestData.update]] method.
 *
 * @example
 *     const { TestData } = require('launchdarkly-node-server-sdk/interfaces');
 *
 *     const td = TestData();
 *     testData.update(td.flag("flag-key-1").booleanFlag().variationForAll(true));
 *     const client = new LDClient(sdkKey, { updateProcessor: td });
 *
 *     // flags can be updated at any time:
 *     td.update(td.flag("flag-key-2")
 *         .variationForContext("user", "some-user-key", true)
 *         .fallthroughVariation(false));
 *
 * The above example uses a simple boolean flag, but more complex configurations are possible using
 * the methods of the [[TestDataFlagBuilder]] that is returned by [[TestData.flag]].
 * [[TestDataFlagBuilder]] supports many of the ways a flag can be configured on the LaunchDarkly
 * dashboard, but does not currently support
 *  1. rule operators other than "in" and "not in", or
 *  2. percentage rollouts.
 *
 * If the same `TestData` instance is used to configure multiple `LDClient` instances,
 * any changes made to the data will propagate to all of the `LDClient`s.
 *
 * @see [[FileDataSource]]
 */
export interface TestData {
  /**
   * Creates or copies a [[TestDataFlagBuilder]] for building a test flag configuration.
   *
   * If the flag key has already been defined in this `TestData` instance,
   * then the builder starts with the same configuration that was last
   * provided for this flag.
   *
   * Otherwise, it starts with a new default configuration in which the flag
   * has `true` and `false` variations, is `true` for all users when targeting
   * is turned on and `false` otherwise, and currently has targeting turned on.
   * You can change any of those properties and provide more complex behavior
   * using the `TestDataFlagBuilder` methods.
   *
   * Once you have set the desired configuration, pass the builder to
   * [[TestData.update]].
   *
   * @param key the flag key
   * @returns a flag configuration builder
   *
   */
  flag(key: string): TestDataFlagBuilder;

  /**
   * Updates the test data with the specified flag configuration.
   *
   * This has the same effect as if a flag were added or modified in the
   * LaunchDarkly dashboard. It immediately propagates the flag changes to
   * any [[LDClient]] instance(s) that you have already configured to use
   * this `TestData`. If no `LDClient` has been started yet, it simply adds
   * this flag to the test data which will be provided to any `LDClient`
   * that you subsequently configure.
   *
   * Any subsequent changes to this `TestDataFlagBuilder` instance do not affect
   * the test data unless you call `update` again.
   *
   * @param flagBuilder a flag configuration builder
   * @return a promise that will resolve when the feature stores are updated
   */
  update(flagBuilder: TestDataFlagBuilder): Promise<any>;

  /**
   * Copies a full feature flag data model object into the test data.
   *
   * It immediately propagates the flag change to any [[LDClient]] instance(s) that you have already
   * configured to use this `TestData`. If no [[LDClient]] has been started yet, it simply adds this
   * flag to the test data which will be provided to any LDClient that you subsequently configure.
   *
   * Use this method if you need to use advanced flag configuration properties that are not
   * supported by the simplified [[TestDataFlagBuilder]] API. Otherwise it is recommended to use the
   * regular [[flag]]/[[update]] mechanism to avoid dependencies on details of the data model.
   *
   * You cannot make incremental changes with [[flag]]/[[update]] to a flag that has been added in
   * this way; you can only replace it with an entirely new flag configuration.
   *
   * @param flagConfig the flag configuration as a JSON object
   * @return a promise that will resolve when the feature stores are updated
   */
  usePreconfiguredFlag(flagConfig: any): Promise<any>;

  /**
   * Copies a full segment data model object into the test data.
   *
   * It immediately propagates the change to any [[LDClient]] instance(s) that you have already
   * configured to use this `TestData`. If no [[LDClient]] has been started yet, it simply adds
   * this segment to the test data which will be provided to any LDClient that you subsequently
   * configure.
   *
   * This method is currently the only way to inject segment data, since there is no builder
   * API for segments. It is mainly intended for the SDK's own tests of segment functionality,
   * since application tests that need to produce a desired evaluation state could do so more easily
   * by just setting flag values.
   *
   * @param segmentConfig the segment configuration as a JSON object
   * @return a promise that will resolve when the feature stores are updated
   */
  usePreconfiguredSegment(segmentConfig: any): Promise<any>;
}

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
  variationForContext(contextKind: string, contextKey: string,
    variation: boolean | number): TestDataFlagBuilder;

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

/**
 * A builder for feature flag rules to be used with [[TestDataFlagBuilder]].
 *
 * In the LaunchDarkly model, a flag can have any number of rules, and
 * a rule can have any number of clauses. A clause is an individual test
 * such as "name is 'X'". A rule matches a user if all of the rule's
 * clauses match the user.
 *
 * To start defining a rule, use one of the flag builder's matching methods
 * such as `ifMatch`. This defines the first clause for the rule. Optionally,
 * you may add more clauses with the rule builder's methods such as `andMatch`.
 * Finally, call `thenReturn` to finish defining the rule.
 */

export interface TestDataRuleBuilder {
  /**
   * Adds another clause using the "is one of" operator.
   *
   * For example, this creates a rule that returns `true` if the name is
   * "Patsy" and the country is "gb":
   *
   *     testData.flag('flag')
   *             .ifMatch('name', 'Patsy')
   *             .andMatch('country', 'gb')
   *             .thenReturn(true)
   *
   * @param contextKind the kind of the context
   * @param attribute the user attribute to match against
   * @param values values to compare to
   * @return the flag rule builder
   */
  andMatch(contextKind: string, attribute: string, ...values: any): TestDataRuleBuilder;

  /**
   * Adds another clause using the "is not one of" operator.
   *
   * For example, this creates a rule that returns `true` if the name is
   * "Patsy" and the country is not "gb":
   *
   *     testData.flag('flag')
   *             .ifMatch('name', 'Patsy')
   *             .andNotMatch('country', 'gb')
   *             .thenReturn(true)
   *
   * @param contextKind the kind of the context
   * @param attribute the user attribute to match against
   * @param values values to compare to
   * @return the flag rule builder
   */
  andNotMatch(contextKind: string, attribute: string, ...values: any): TestDataRuleBuilder;

  /**
   * Finishes defining the rule, specifying the result value as either a boolean or an index
   *
   * If the variation is a boolean value and the flag was not already a boolean
   * flag, this also changes it to be a boolean flag.
   *
   * If the variation is an integer, it specifies a variation out of whatever
   * variation values have already been defined.

   * @param variation
   *    either `true` or `false` or the index of the desired variation:
   *    0 for the first, 1 for the second, etc.
   * @return the flag rule builder
   */
  thenReturn(variation: boolean | number): TestDataFlagBuilder;
}
