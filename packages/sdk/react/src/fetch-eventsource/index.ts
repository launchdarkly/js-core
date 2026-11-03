/**
 * Optional `fetch()`-based EventSource for the React SDK's streaming connection.
 *
 * This entry point re-exports the browser SDK's `fetch-eventsource` entry. Pass
 * `fetchBrowserEventSource` as the `eventSource` option to opt in. The native browser EventSource
 * remains the default, and only an application that imports this entry pays for the alternative.
 *
 * The `@launchdarkly/eventsource` dependency is optional. If an install omits optional
 * dependencies, install it directly before this entry point is imported.
 *
 * @packageDocumentation
 */
export { fetchBrowserEventSource } from '@launchdarkly/js-client-sdk/fetch-eventsource';
export type { LDEventSourceFactory } from '@launchdarkly/js-client-sdk/fetch-eventsource';
