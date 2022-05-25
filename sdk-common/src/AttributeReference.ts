function processEscapeCharacters(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function getComponents(reference: string): string[] {
  const referenceWithoutPrefix = reference.startsWith('/') ? reference.substring(1) : reference;
  return referenceWithoutPrefix
    .split('/')
    .map((component) => (component.indexOf('~') >= 0 ? processEscapeCharacters(component) : component));
}

function isLiteral(reference: string) {
  return !reference.startsWith('/');
}

function isValid(reference: string) {
  return !reference.match(/\/\/|(^\/.*~[^0|^1])|~$/);
}

export default class AttributeReference {
  public readonly isValid;

  public readonly original;

  private readonly components?: string[];

  constructor(reference: string) {
    this.original = reference;
    if (reference === '' || reference === '/' || !isValid(reference)) {
      this.isValid = false;
    } else if (isLiteral(reference)) {
      this.components = [reference];
    } else if (reference.indexOf('/', 1) < 0) {
      this.components = [reference.slice(1)];
    } else {
      this.components = getComponents(reference);
    }
  }

  public depth(): number | undefined {
    return this.components?.length;
  }

  public getComponent(index: number): string | undefined {
    return this.components?.[index];
  }
}
