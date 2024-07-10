const CHILD_COMBINATOR = '>';
const CHILD_SEPARATOR = ` ${CHILD_COMBINATOR} `;

interface NodeWithParent {
  parentNode?: NodeWithParent;
}

interface BasicElement {
  tagName?: string;
  id?: string;
  className?: string;
  // getAttribute(key: string): string;
}

function isNode(element: unknown): element is NodeWithParent {
  const anyElement = element as any;
  return typeof anyElement === 'object' && anyElement.parentNode !== undefined;
}

function isElement(element: unknown): element is BasicElement {
  const anyElement = element as any;
  return typeof anyElement === 'object' && typeof anyElement.getAttribute === 'function';
}

function getClassName(element: BasicElement): string | undefined {
  if (typeof element.className !== `string`) {
    return undefined;
  }
  let value = element.className;
  // Elements should be space separated in a class attribute. If there are other kinds of
  // whitespace, then this code could need adjustment.
  if (element.className.includes(' ')) {
    value = element.className.replace(' ', '.');
  }
  if (value !== '') {
    return `.${value}`;
  }
  return undefined;
}

function elementToString(element: BasicElement): string {
  if (!element.tagName) {
    return '';
  }

  const components: string[] = [];

  components.push(element.tagName.toLowerCase());
  if (element.id) {
    components.push(`#${element.id}`);
  }

  const className = getClassName(element);
  if (className) {
    components.push(className);
  }

  return components.join('');
}

export default function toSelector(
  element: unknown,
  options: {
    maxDepth: number;
  } = { maxDepth: 10 },
): string {
  const components: string[] = [];
  let ptr = element;
  while (isNode(ptr) && ptr.parentNode) {
    const asString = isElement(ptr) ? elementToString(ptr) : '';
    if (asString === 'html') {
      break;
    }
    if (components.length > options.maxDepth) {
      break;
    }

    components.push(asString);
    ptr = ptr.parentNode;
  }
  return components.reverse().join(CHILD_SEPARATOR);
}
