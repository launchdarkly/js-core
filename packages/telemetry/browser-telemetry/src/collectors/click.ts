import { BrowserTelemetry } from '../api/BrowserTelemetry.js';
import { Collector } from '../api/Collector.js';

function getXPath(element: Element | null): string {
  if (!element) {
    // TODO: Handle.
    return '';
  }
  if (element.id !== '') {
    // If the element has an ID, use it
    return `id("${element.id}")`;
  }
  if (element === document.body) {
    // If the element is the body, return /html/body
    return '/html/body';
  }

  let ix = 0;
  const siblings = element.parentNode?.childNodes;

  if (!siblings) {
    // TODO: Handle.
    return '';
  }

  for (let i = 0; i < siblings.length; i += 1) {
    const sibling = siblings[i];
    if (sibling === element) {
      // Recursively get the XPath of the parent element and append the current element's position
      return `${getXPath(element.parentNode as Element)}/${element.tagName.toLowerCase()}[${
        ix + 1
      }]`;
    }
    const sibElement = sibling as Element;
    if (sibling.nodeType === 1 && sibElement.tagName === element.tagName) {
      ix += 1;
    }
  }
}

export default class ClickCollector implements Collector {
  private destinations: Set<BrowserTelemetry> = new Set();

  constructor() {
    window.addEventListener(
      'click',
      (event: MouseEvent) => {
        this.destinations.forEach((destination) =>
          destination.addBreadcrumb({
            type: 'click',
            target: getXPath(event.target as Element),
          }),
        );
      },
      true,
    );
  }

  register(telemetry: BrowserTelemetry): void {
    this.destinations.add(telemetry);
  }
  unregister(telemetry: BrowserTelemetry): void {
    this.destinations.delete(telemetry);
  }
}
