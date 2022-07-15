import { AttributeReference, TypeValidators } from '@launchdarkly/js-sdk-common';
import { variationForBoolean } from './booleanVariation';
import { Clause } from '../../evaluation/data/Clause';

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

export default class TestDataRuleBuilder<BuilderType> {
  private clauses: Clause[] = [];

  private variation?: number;

  /**
   * @internal
   */
  constructor(
    private readonly flagBuilder: BuilderType & {
      addRule: (rule: TestDataRuleBuilder<BuilderType>) => void,
      booleanFlag: () => BuilderType,
    },
    clauses?: Clause[],
    variation?: number,
  ) {
    if (clauses) {
      this.clauses = JSON.parse(JSON.stringify(clauses));
    }
    if (variation !== undefined) {
      this.variation = variation;
    }
  }

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
  andMatch(
    contextKind: string,
    attribute: string,
    ...values: any
  ): TestDataRuleBuilder<BuilderType> {
    this.clauses.push({
      contextKind,
      attribute,
      attributeReference: new AttributeReference(attribute),
      op: 'in',
      values,
      negate: false,
    });
    return this;
  }

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
  andNotMatch(
    contextKind: string,
    attribute: string,
    ...values: any
  ): TestDataRuleBuilder<BuilderType> {
    this.clauses.push({
      contextKind,
      attribute,
      attributeReference: new AttributeReference(attribute),
      op: 'in',
      values,
      negate: true,
    });
    return this;
  }

  /**
   * Finishes defining the rule, specifying the result value as either a boolean or an index
   *
   * If the variation is a boolean value and the flag was not already a boolean
   * flag, this also changes it to be a boolean flag.
   *
   * If the variation is an integer, it specifies a variation out of whatever
   * variation values have already been defined.
   *
   * @param variation
   *    either `true` or `false` or the index of the desired variation:
   *    0 for the first, 1 for the second, etc.
   * @return the flag rule builder
   */
  thenReturn(variation: number | boolean): BuilderType {
    if (TypeValidators.Boolean.is(variation)) {
      this.flagBuilder.booleanFlag();
      return this.thenReturn(variationForBoolean(variation));
    }

    this.variation = variation;
    this.flagBuilder.addRule(this);
    return this.flagBuilder;
  }

  /**
   * @internal
   */
  build(id: string) {
    return {
      id: `rule${id}`,
      variation: this.variation,
      clauses: this.clauses,
    };
  }

  /**
   * @internal
   */
  clone(): TestDataRuleBuilder<BuilderType> {
    return new TestDataRuleBuilder<BuilderType>(this.flagBuilder, this.clauses, this.variation);
  }
}
