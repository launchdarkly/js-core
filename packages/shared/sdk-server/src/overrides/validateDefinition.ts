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
 * assumed type: a list is an array, an entry of a list is an object, and an attribute name that
 * becomes an attribute reference is a string. A field is required only where evaluation reads it
 * without a guard: the variations of a flag and the values of a target or clause. Every other
 * field may be absent, as it may be in LaunchDarkly data, and a null field counts as absent
 * because the preparation removes null fields. The checks go no further. The content of a field,
 * such as a variation index or an operator name, is evaluation's concern, and evaluation reports
 * a malformed-flag result for it.
 */

type DefinitionKind = 'flag' | 'segment';

type Definition = Record<string, any>;

function isObject(value: unknown): value is Definition {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (value === undefined || value === null) {
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
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!isObject(value)) {
      this.fail(`"${field}" must be an object`);
    }
    return value;
  }

  /**
   * Checks that an optional field is a string when it is present.
   */
  string(parent: Definition, field: string): void {
    const value = parent[field];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      this.fail(`"${field}" must be a string`);
    }
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
      if (!isObject(entry)) {
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
    targetAt.array(target, 'values', true);
  });
}

/**
 * A clause is read by its values. Its attribute becomes an attribute reference during
 * preparation when it is present.
 */
function checkClauses(rule: Definition, at: Location): void {
  at.entries(rule, 'clauses', 'clause', (clause, clauseAt) => {
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
  at.array(segment, 'included');
  at.array(segment, 'excluded');
  checkTargets(segment, at, 'includedContexts', 'included context');
  checkTargets(segment, at, 'excludedContexts', 'excluded context');
  at.entries(segment, 'rules', 'rule', (rule, ruleAt) => {
    checkClauses(rule, ruleAt);
    ruleAt.string(rule, 'bucketBy');
  });
}
