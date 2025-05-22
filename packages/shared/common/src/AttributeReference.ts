import { LDContextCommon } from './api/context/LDContextCommon';

/**
 * Converts a literal to a ref string.
 * @param value
 * @returns An escaped literal which can be used as a ref.
 */
function toRefString(value: string): string {
  return `/${value.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

/**
 * Produce a literal from a ref component.
 * @param ref
 * @returns A literal version of the ref.
 */
function unescape(ref: string): string {
  return ref.indexOf('~') ? ref.replace(/~1/g, '/').replace(/~0/g, '~') : ref;
}

function getComponents(reference: string): string[] {
  const referenceWithoutPrefix = reference.startsWith('/') ? reference.substring(1) : reference;
  return referenceWithoutPrefix.split('/').map((component) => unescape(component));
}

function isLiteral(reference: string): boolean {
  return !reference.startsWith('/');
}

function validate(reference: string): boolean {
  return !reference.match(/\/\/|(^\/.*~[^0|^1])|~$/);
}

export default class AttributeReference {
  public readonly isValid;

  /**
   * When redacting attributes this name can be directly added to the list of
   * redactions.
   */
  public readonly redactionName;

  /**
   * For use as invalid references when deserializing Flag/Segment data.
   */
  public static readonly InvalidReference = new AttributeReference('');

  private readonly _components: string[];

  /**
   * Take an attribute reference string, or literal string, and produce
   * an attribute reference.
   *
   * Legacy user objects would have been created with names not
   * references. So, in that case, we need to use them as a component
   * without escaping them.
   *
   * e.g. A user could contain a custom attribute of `/a` which would
   * become the literal `a` if treated as a reference. Which would cause
   * it to no longer be redacted.
   * @param refOrLiteral The attribute reference string or literal string.
   * @param literal it true the value should be treated as a literal.
   */
  public constructor(refOrLiteral: string, literal: boolean = false) {
    if (!literal) {
      this.redactionName = refOrLiteral;
      if (refOrLiteral === '' || refOrLiteral === '/' || !validate(refOrLiteral)) {
        this.isValid = false;
        this._components = [];
        return;
      }

      if (isLiteral(refOrLiteral)) {
        this._components = [refOrLiteral];
      } else if (refOrLiteral.indexOf('/', 1) < 0) {
        this._components = [unescape(refOrLiteral.slice(1))];
      } else {
        this._components = getComponents(refOrLiteral);
      }
      // The items inside of '_meta' are not intended to be addressable.
      // Excluding it as a valid reference means that we can make it non-addressable
      // without having to copy all the attributes out of the context object
      // provided by the user.
      if (this._components[0] === '_meta') {
        this.isValid = false;
      } else {
        this.isValid = true;
      }
    } else {
      const literalVal = refOrLiteral;
      this._components = [literalVal];
      this.isValid = literalVal !== '';
      // Literals which start with '/' need escaped to prevent ambiguity.
      this.redactionName = literalVal.startsWith('/') ? toRefString(literalVal) : literalVal;
    }
  }

  public get(target: LDContextCommon) {
    const { _components: components, isValid } = this;
    if (!isValid) {
      return undefined;
    }

    let current = target;

    // This doesn't use a range based for loops, because those use generators.
    // See `no-restricted-syntax`.
    // It also doesn't use a collection method because this logic is more
    // straightforward with a loop.
    for (let index = 0; index < components.length; index += 1) {
      const component = components[index];
      if (
        current !== null &&
        current !== undefined &&
        // See https://eslint.org/docs/rules/no-prototype-builtins
        Object.prototype.hasOwnProperty.call(current, component) &&
        typeof current === 'object' &&
        // We do not want to allow indexing into an array.
        !Array.isArray(current)
      ) {
        current = current[component];
      } else {
        return undefined;
      }
    }
    return current;
  }

  public getComponent(depth: number) {
    return this._components[depth];
  }

  public get depth() {
    return this._components.length;
  }

  public get isKind(): boolean {
    return this._components.length === 1 && this._components[0] === 'kind';
  }

  public compare(other: AttributeReference) {
    return (
      this.depth === other.depth &&
      this._components.every((value, index) => value === other.getComponent(index))
    );
  }

  public get components() {
    return [...this._components];
  }
}
