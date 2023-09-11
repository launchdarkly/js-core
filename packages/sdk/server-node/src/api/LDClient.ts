import { EventEmitter } from 'events';

import { LDClient as LDClientCommon } from '@launchdarkly/js-server-sdk-common';

import { BigSegmentStoreStatusProvider } from './interfaces';

/**
 * The LaunchDarkly SDK client object.
 *
 * Create this object with {@link init}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 * Note that `LDClient` inherits from `EventEmitter`, so you can use the standard `on()`, `once()`, and
 * `off()` methods to receive events. The standard `EventEmitter` methods are not documented here; see the
 * {@link https://nodejs.org/api/events.html#events_class_eventemitter|Node API documentation}. For a
 * description of events you can listen for, see {@link on}.
 *
 */
export interface LDClient extends LDClientCommon, EventEmitter {
  /**
   * A mechanism for tracking the status of a Big Segment store.
   *
   * This object has methods for checking whether the Big Segment store is (as far as the SDK
   * knows) currently operational and tracking changes in this status. See
   * {@link interfaces.BigSegmentStoreStatusProvider} for more about this functionality.
   */
  readonly bigSegmentStoreStatusProvider: BigSegmentStoreStatusProvider;

  /**
   *
   * Registers an event listener that will be called when the client triggers some type of event.
   *
   * This is the standard `on` method inherited from Node's `EventEmitter`; see the
   * {@link https://nodejs.org/api/events.html#events_class_eventemitter|Node API docs} for more
   * details on how to manage event listeners. Here is a description of the event types defined
   * by `LDClient`.
   *
   * - `"ready"`: Sent only once, when the client has successfully connected to LaunchDarkly.
   * Alternately, you can detect this with [[waitForInitialization]].
   * - `"failed"`: Sent only once, if the client has permanently failed to connect to LaunchDarkly.
   * Alternately, you can detect this with [[waitForInitialization]].
   * - `"error"`: Contains an error object describing some abnormal condition that the client has detected
   * (such as a network error).
   * - `"update"`: The client has received a change to a feature flag. The event parameter is an object
   * containing a single property, `key`, the flag key. Note that this does not necessarily mean the flag's
   * value has changed for any particular context, only that some part of the flag configuration was changed.
   * - `"update:KEY"`: The client has received a change to the feature flag whose key is KEY. This is the
   * same as `"update"` but allows you to listen for a specific flag.
   *
   * @param event the name of the event to listen for
   * @param listener the function to call when the event happens
   */
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}
