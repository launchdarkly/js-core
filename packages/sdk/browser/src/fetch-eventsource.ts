/**
 * Optional `fetch()`-based EventSource for the browser SDK's streaming connection.
 *
 * This lives behind its own entry point so that neither the implementation nor its dependency ends
 * up in the default bundle: the native browser EventSource remains the default, and only an
 * application that imports this pays for the alternative.
 *
 * The `@launchdarkly/eventsource` dependency is optional. If an install omits optional
 * dependencies, install it directly before this entry point is imported.
 *
 * @packageDocumentation
 */
export { default as fetchBrowserEventSource } from './platform/fetchBrowserEventSource';
export type { LDEventSourceFactory } from '@launchdarkly/js-client-sdk-common';
