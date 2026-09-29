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
 */
export interface LDEventSourceFactory {
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource;

  /**
   * Capabilities of the event sources this factory produces.
   *
   * The SDK checks these before using a feature that not every transport supports -- for instance,
   * it only issues a REPORT streaming request when `customMethod` is true. When this is omitted,
   * every capability is treated as unsupported
   *
   * @remark
   * `customMethod` is currently the only capability that changes SDK behavior; declaring `headers: false`
   * or `readTimeout: false` does not stop the SDK from supplying those init options.
   */
  capabilities?: EventSourceCapabilities;
}
