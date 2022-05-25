import { LDContextCommon } from './api';

function processEscapeCharacters(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function getComponents(reference: string): string[] {
  const referenceWithoutPrefix = reference.startsWith('/') ? reference.substring(1) : reference;
  return referenceWithoutPrefix
    .split('/')
    .map((component) => (component.indexOf('~') >= 0 ? processEscapeCharacters(component) : component));
}

function isLiteral(reference: string): boolean {
  return !reference.startsWith('/');
}

function validate(reference: string): boolean {
  return !reference.match(/\/\/|(^\/.*~[^0|^1])|~$/);
}

export default class AttributeReference {
  public readonly isValid;

  public readonly original;

  private readonly components: string[];

  constructor(reference: string) {
    this.original = reference;
    if (reference === '' || reference === '/' || !validate(reference)) {
      this.isValid = false;
      this.components = [];
    } else if (isLiteral(reference)) {
      this.components = [reference];
    } else if (reference.indexOf('/', 1) < 0) {
      this.components = [reference.slice(1)];
    } else {
      this.components = getComponents(reference);
    }
  }

  public get(target: LDContextCommon) {
    const { components, isValid } = this;
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
        current !== null
        && current !== undefined
        // See https://eslint.org/docs/rules/no-prototype-builtins
        && Object.prototype.hasOwnProperty.call(current, component)
        && typeof current === 'object'
      ) {
        current = current[component];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
