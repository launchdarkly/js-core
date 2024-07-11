// https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator
const CHILD_COMBINATOR = '>';
// Spacing around the combinator is optional, but it increases readability.
const CHILD_SEPARATOR = ` ${CHILD_COMBINATOR} `;

/**
 * The elements of a node we need for traversal.
 */
interface NodeWithParent {
  parentNode?: NodeWithParent;
}

/**
 * The elements of a node we need to generate a string representation.
 *
 * All element fields are optional, so a type guard is not required to use this typing.
 */
interface BasicElement {
  tagName?: string;
  id?: string;
  className?: string;
}

/**
 * Type guard that verifies that an element complies with {@link NodeWithParent}.
 */
function isNode(element: unknown): element is NodeWithParent {
  const anyElement = element as any;
  // Parent node being null or undefined fill be falsy.
  // The type of `null` is object, so check for null as well.
  return typeof anyElement === 'object' && anyElement != null && anyElement.parentNode;
}

/**
 * Given an element produce a class name in CSS selector format.
 *
 * Exported for testing.
 *
 * @param element The element to get a class name for.
 * @returns The class name, or undefined if there is no class name.
 */
export function getClassName(element: BasicElement): string | undefined {
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
  // There was no class name.
  return undefined;
}

/**
 * Produce a string representation for a single DOM element. Does not produce the full selector.
 *
 * Exported for testing.
 *
 * @param element The element to produce a text representation for.
 * @returns A text representation of the element, or an empty string if one cannot be produced.
 */
export function elementToString(element: BasicElement): string {
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

/**
 * Given an HTML element produce a CSS selector.
 *
 * Defaults to a maximum depth of 10 components.
 *
 * Example:
 * ```
 * <html>
 *  <body>
 *    <div>
 *      <ul>
 *        <li class="some-class">
 *          <p id="some-id">toaster</p>
 *        </li>
 *      </ul>
 *    </div>
 *  </body>
 * </html>
 * ```
 * The <p> element in the above HTML would produce:
 * `body > div > ul > li.some-class > p#some-id`
 *
 * @param element The element to generate a selector from.
 * @param options Options which control selector generation.
 * @returns The generated selector.
 */
export default function toSelector(
  element: unknown,
  options: {
    maxDepth: number;
  } = { maxDepth: 10 },
): string {
  // For production we may want to consider if we additionally limit the maximum selector length.
  // Limiting the components should generate reasonable selectors in most cases.
  const components: string[] = [];
  let ptr = element;
  while (isNode(ptr) && ptr.parentNode && components.length < options.maxDepth) {
    const asString = elementToString(ptr as BasicElement);
    // We do not need to include the 'html' component in the selector.
    // The HTML element can be assumed to be the top. If there are more elements
    // we would not want to include them (they would be something non-standard).
    if (asString === 'html') {
      break;
    }

    components.push(asString);
    ptr = ptr.parentNode;
  }
  return components.reverse().join(CHILD_SEPARATOR);
}
