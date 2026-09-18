import type {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
} from '@launchdarkly/js-sdk-common';

/**
 * Factory for the EventSource implementation a client-side SDK uses for its streaming connection.
 *
 * This should only be used when customizing the streaming transport. Typical usage of the SDK does
 * not require implementing this.
 *
 * `createEventSource` is called once per stream start (not once per connection attempt): the
 * returned object owns its own reconnection and backoff for as long as the stream stays open (it
 * should honor `errorFilter`/`initialRetryDelayMillis`/`retryResetIntervalMillis`/`urlBuilder` from
 * the init dict -- in particular, `errorFilter` decides whether a given failure is retryable at
 * all, so ignoring it risks retrying an unrecoverable error like a 401 forever -- and emit
 * `onretrying` on each attempt), and connect immediately, which is what the platform EventSource
 * contract requires. The SDK does not call `createEventSource` again after a drop -- only when it
 * deliberately starts a new stream (e.g. on `identify()`).
 */
export interface LDEventSourceFactory {
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource;

  /**
   * Capabilities of the event sources this factory produces.
   *
   * The SDK checks these before using a feature that not every transport supports -- for instance,
   * it only issues a REPORT streaming request when `customMethod` is true. When this is omitted,
   * every capability is treated as unsupported. Note that `customMethod` is currently the only
   * capability that changes SDK behavior; declaring `headers: false` or `readTimeout: false` does
   * not stop the SDK from supplying those init options.
   */
  capabilities?: EventSourceCapabilities;
}
