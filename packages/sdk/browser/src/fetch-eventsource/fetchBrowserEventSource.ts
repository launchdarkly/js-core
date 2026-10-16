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
 * GET with a request body, and apply a read timeout. The custom method support is what lets the
 * FDv2 `usePost` option stream evaluations over POST. It requires `fetch()`, `AbortController` and
 * a streaming `Response.body`, which all current browsers provide.
 *
 * This transport never sends the `x-launchdarkly-tags` header, for any stream endpoint,
 * because the LaunchDarkly streaming service's CORS allow-list does not include it.
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
  createEventSource: (url: string, eventSourceInitDict: EventSourceInitDict): LDEventSource => {
    // The LaunchDarkly streaming service's CORS allow-list does not include
    // x-launchdarkly-tags. A browser preflight with that header fails, and the stream
    // can never connect.
    const { 'x-launchdarkly-tags': _tags, ...headers } = eventSourceInitDict.headers;
    return createEventSource(url, {
      ...eventSourceInitDict,
      headers,
      // The backoff ceiling and jitter apply to the transport's built-in retry strategy.
      // A data source that injects its own retryDelayStrategy owns all retry timing, and
      // the transport then ignores these two values.
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
    });
  },
  capabilities: CAPABILITIES,
};

export default fetchBrowserEventSource;
