/**
 * Shape checks for the definitions an override source supplies.
 *
 * The SDK stores flag and segment definitions in their JSON form, without a typed
 * deserialization, so evaluation reads the fields of a definition with the types the data model
 * declares. LaunchDarkly data has that shape. A hand-written override definition may not, and a
 * field of the wrong type makes evaluation throw where a malformed-flag result is expected. The
 * override layer is the one path that admits definitions from outside LaunchDarkly, so it checks
 * the shape here, before a definition is prepared and stored.
 *
 * The checks cover the fields that evaluation and the preparation of a definition read with an
 * assumed type: a key is a string, the on switch of a flag is a boolean, a list is an array, an
 * entry of a list is an object, and an attribute name that becomes an attribute reference is a
 * string. A field is required only where the layer or evaluation reads it without a guard: the
 * key, the variations of a flag, and the values of a target or clause. Every other field may be
 * absent, as it may be in LaunchDarkly data, and a null field counts as absent because the
 * preparation removes null fields. The fields that the preparation itself sets, such as the sets
 * it generates for large target lists, cannot be supplied. The checks go no further. The content
 * of a field, such as a variation index or an operator name, is evaluation's concern, and
 * evaluation reports a malformed-flag result for it.
 */

import { isNullish, TypeValidators } from '@launchdarkly/js-sdk-common';

type DefinitionKind = 'flag' | 'segment';

type Definition = Record<string, any>;

/**
 * Reports whether a value is an object that is not an array and not null.
 *
 * @internal
 */
export function isPlainObject(value: unknown): value is Definition {
  return !isNullish(value) && TypeValidators.Object.is(value);
}

/**
 * The part of a definition under examination: the kind and key of the definition, and the steps
 * from its root to the part, for example "rule 2" then "clause 0". Each check throws an Error
 * that names them and the field that failed.
 */
class Location {
  constructor(
    private readonly _kind: DefinitionKind,
    private readonly _key: string,
    private readonly _steps: string[] = [],
  ) {}

  at(step: string): Location {
    return new Location(this._kind, this._key, [...this._steps, step]);
  }

  fail(message: string): never {
    const where = this._steps.length > 0 ? `${this._steps.join(', ')}: ` : '';
    throw new Error(`${this._kind} "${this._key}": ${where}${message}`);
  }

  /**
   * Checks that a field is an array. An optional field may be absent.
   *
   * @returns The array, or undefined when an optional field is absent.
   */
  array(parent: Definition, field: string, required: boolean = false): any[] | undefined {
    const value = parent[field];
    if (isNullish(value)) {
      if (required) {
        this.fail(`"${field}" must be an array`);
      }
      return undefined;
    }
    if (!Array.isArray(value)) {
      this.fail(`"${field}" must be an array`);
    }
    return value;
  }

  /**
   * Checks that an optional field is an object when it is present.
   *
   * @returns The object, or undefined when the field is absent.
   */
  object(parent: Definition, field: string): Definition | undefined {
    const value = parent[field];
    if (isNullish(value)) {
      return undefined;
    }
    if (!isPlainObject(value)) {
      this.fail(`"${field}" must be an object`);
    }
    return value;
  }

  /**
   * Checks that a field is a string. An optional field may be absent.
   */
  string(parent: Definition, field: string, required: boolean = false): void {
    const value = parent[field];
    if (isNullish(value)) {
      if (required) {
        this.fail(`"${field}" must be a string`);
      }
      return;
    }
    if (typeof value !== 'string') {
      this.fail(`"${field}" must be a string`);
    }
  }

  /**
   * Checks that an optional field is a boolean when it is present.
   */
  boolean(parent: Definition, field: string): void {
    const value = parent[field];
    if (!isNullish(value) && typeof value !== 'boolean') {
      this.fail(`"${field}" must be a boolean`);
    }
  }

  /**
   * Rejects fields that the SDK itself sets when it prepares a definition for evaluation: the
   * sets it generates for large target lists and the attribute references it compiles. A
   * supplied value for one of them is not what evaluation expects, and the preparation does not
   * always replace it, so a definition that carries one is rejected.
   */
  noInternalFields(parent: Definition, ...names: string[]): void {
    Object.keys(parent).forEach((field) => {
      if (field.startsWith('generated_') || names.includes(field)) {
        this.fail(`"${field}" is set by the SDK and cannot be supplied`);
      }
    });
  }

  /**
   * Checks that an optional field is an array of objects when it is present, and runs a check on
   * each entry at the entry's location. The label names an entry in a message, for example
   * "rule" for the entries of "rules".
   */
  entries(
    parent: Definition,
    field: string,
    label: string,
    check: (entry: Definition, at: Location) => void = () => {},
  ): void {
    this.array(parent, field)?.forEach((entry, index) => {
      if (!isPlainObject(entry)) {
        this.fail(`${label} ${index} must be an object`);
      }
      check(entry, this.at(`${label} ${index}`));
    });
  }
}

/**
 * A target of a flag, or a context target of a segment, is read by its values.
 */
function checkTargets(parent: Definition, at: Location, field: string, label: string): void {
  at.entries(parent, field, label, (target, targetAt) => {
    targetAt.noInternalFields(target);
    targetAt.array(target, 'values', true);
  });
}

/**
 * A clause is read by its values. Its attribute becomes an attribute reference during
 * preparation when it is present.
 */
function checkClauses(rule: Definition, at: Location): void {
  at.entries(rule, 'clauses', 'clause', (clause, clauseAt) => {
    clauseAt.noInternalFields(clause);
    clauseAt.array(clause, 'values', true);
    clauseAt.string(clause, 'attribute');
  });
}

/**
 * A rollout, of a fallthrough or of a rule, is read by its weighted variations. Its bucketBy
 * becomes an attribute reference during preparation when it is present.
 */
function checkRollout(parent: Definition, at: Location): void {
  const rollout = at.object(parent, 'rollout');
  if (rollout) {
    const rolloutAt = at.at('rollout');
    rolloutAt.noInternalFields(rollout, 'bucketByAttributeReference');
    rolloutAt.string(rollout, 'bucketBy');
    rolloutAt.entries(rollout, 'variations', 'variation');
  }
}

/**
 * Checks that a flag definition has the shape that evaluation requires. Throws an Error that
 * names the flag and the field when it does not.
 *
 * @internal
 */
export function validateFlag(flag: Definition): void {
  const at = new Location('flag', `${flag.key}`);
  at.string(flag, 'key', true);
  at.noInternalFields(flag);
  at.boolean(flag, 'on');
  at.array(flag, 'variations', true);
  at.entries(flag, 'prerequisites', 'prerequisite');
  checkTargets(flag, at, 'targets', 'target');
  checkTargets(flag, at, 'contextTargets', 'context target');
  const fallthrough = at.object(flag, 'fallthrough');
  if (fallthrough) {
    checkRollout(fallthrough, at.at('fallthrough'));
  }
  at.entries(flag, 'rules', 'rule', (rule, ruleAt) => {
    checkClauses(rule, ruleAt);
    checkRollout(rule, ruleAt);
  });
}

/**
 * Checks that a segment definition has the shape that evaluation requires. Throws an Error that
 * names the segment and the field when it does not.
 *
 * @internal
 */
export function validateSegment(segment: Definition): void {
  const at = new Location('segment', `${segment.key}`);
  at.string(segment, 'key', true);
  at.noInternalFields(segment);
  at.array(segment, 'included');
  at.array(segment, 'excluded');
  checkTargets(segment, at, 'includedContexts', 'included context');
  checkTargets(segment, at, 'excludedContexts', 'excluded context');
  at.entries(segment, 'rules', 'rule', (rule, ruleAt) => {
    ruleAt.noInternalFields(rule, 'bucketByAttributeReference');
    checkClauses(rule, ruleAt);
    ruleAt.string(rule, 'bucketBy');
  });
}
