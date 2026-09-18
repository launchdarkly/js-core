import { createEventSource } from '@launchdarkly/eventsource';
import {
  EventSourceCapabilities,
  EventSourceInitDict,
  LDEventSourceFactory,
  EventSource as LDEventSource,
} from '@launchdarkly/js-client-sdk-common';

/** The fetch-based implementation supports every optional transport feature. */
const CAPABILITIES: EventSourceCapabilities = {
  customMethod: true,
  readTimeout: true,
  headers: true,
};

/**
 * An {@link LDEventSourceFactory} that produces a `fetch()`-based EventSource instead of the native
 * browser one.
 *
 * Unlike the native browser EventSource, this one can send request headers, use a method other than
 * GET with a request body (which is what REPORT streaming needs), and apply a read timeout. It
 * requires `fetch()`, `AbortController` and a streaming `Response.body`, which every evergreen
 * browser provides.
 *
 * It is not the default. Pass it as the `eventSource` option to opt in:
 *
 * ```javascript
 * import { createClient } from '@launchdarkly/js-client-sdk';
 * import { fetchBrowserEventSource } from '@launchdarkly/js-client-sdk/fetch-eventsource';
 *
 * const client = createClient(clientSideId, context, { eventSource: fetchBrowserEventSource });
 * ```
 */
const fetchBrowserEventSource: LDEventSourceFactory = {
  createEventSource: (url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource =>
    createEventSource(url, {
      ...eventSourceInitDict,
      // Retry shaping the platform init dict does not carry, matching what the Node SDKs pass to
      // the same package.
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
    }),
  capabilities: CAPABILITIES,
};

export default fetchBrowserEventSource;
