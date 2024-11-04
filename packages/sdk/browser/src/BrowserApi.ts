/**
 * All access to browser specific APIs should be limited to this file.
 * Care should be taken to ensure that any given method will work in the service worker API. So if
 * something isn't available in the service worker API attempt to provide reasonable defaults.
 */

export function isDocument() {
  return typeof document !== undefined;
}

export function isWindow() {
  return typeof window !== undefined;
}

/**
 * Register an event handler on the document. If there is no document, such as when running in
 * a service worker, then no operation is performed.
 *
 * @param type The event type to register a handler for.
 * @param listener The handler to register.
 * @param options Event registration options.
 * @returns a function which unregisters the handler.
 */
export function addDocumentEventListener(
  type: string,
  listener: (this: Document, ev: Event) => any,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (isDocument()) {
    document.addEventListener(type, listener, options);
    return () => {
      document.removeEventListener(type, listener, options);
    };
  }
  // No document, so no need to unregister anything.
  return () => {};
}

/**
 * Register an event handler on the window. If there is no window, such as when running in
 * a service worker, then no operation is performed.
 *
 * @param type The event type to register a handler for.
 * @param listener The handler to register.
 * @param options Event registration options.
 * @returns a function which unregisters the handler.
 */
export function addWindowEventListener(
  type: string,
  listener: (this: Document, ev: Event) => any,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (isDocument()) {
    window.addEventListener(type, listener, options);
    return () => {
      window.removeEventListener(type, listener, options);
    };
  }
  // No document, so no need to unregister anything.
  return () => {};
}

/**
 * For non-window code this will always be an empty string.
 */
export function getHref(): string {
  if (isWindow()) {
    return window.location.href;
  }
  return '';
}

/**
 * For non-window code this will always be an empty string.
 */
export function getLocationSearch(): string {
  if (isWindow()) {
    return window.location.search;
  }
  return '';
}

/**
 * For non-window code this will always be an empty string.
 */
export function getLocationHash(): string {
  if (isWindow()) {
    return window.location.hash;
  }
  return '';
}

export function getCrypto(): Crypto {
  if (typeof crypto !== undefined) {
    return crypto;
  }
  // This would indicate running in an environment that doesn't have window.crypto or self.crypto.
  throw Error('Access to a web crypto API is required');
}

/**
 * Get the visibility state. For non-documents this will always be 'invisible'.
 *
 * @returns The document visibility.
 */
export function getVisibility(): string {
  if (isDocument()) {
    return document.visibilityState;
  }
  return 'visibile';
}

export function querySelectorAll(selector: string): NodeListOf<Element> | undefined {
  if (isDocument()) {
    return document.querySelectorAll(selector);
  }
  return undefined;
}
