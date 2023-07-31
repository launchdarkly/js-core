import { LDContext, LDEvaluationDetail, LDFlagValue } from '@launchdarkly/js-sdk-common';

import { LDFlagsState } from './data/LDFlagsState';
import { LDMigrationStage } from './data/LDMigrationStage';
import { LDFlagsStateOptions } from './data/LDFlagsStateOptions';

/**
 * The LaunchDarkly SDK client object.
 *
 * Create this object with {@link init}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 */
export interface LDClient {
  /**
   * Tests whether the client has completed initialization.
   *
   * If this returns false, it means that the client has not yet successfully connected to
   * LaunchDarkly. It might still be in the process of starting up, or it might be attempting to
   * reconnect after an unsuccessful attempt, or it might have received an unrecoverable error (such
   * as an invalid SDK key) and given up.
   *
   * @returns
   *   True if the client has successfully initialized.
   */
  initialized(): boolean;

  /**
   * Returns a Promise that tracks the client's initialization state.
   *
   * The Promise will be resolved if the client successfully initializes, or rejected if client
   * initialization has failed unrecoverably (for instance, if it detects that the SDK key is
   * invalid). Keep in mind that unhandled Promise rejections can be fatal in Node, so if you call
   * this method, be sure to attach a rejection handler to it (or, if using `async`/`await`, a catch
   * block).
   *
   * Note that you can also use event listeners ({@link on}) for the same purpose: the event
   * `"ready"` indicates success, and `"failed"` indicates failure.
   *
   * There is no built-in timeout for this method. If you want your code to stop waiting on the
   * Promise after some amount of time, you could use
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race|`Promise.race()`}
   * or one of the several NPM helper packages that provides a standard mechanism for this.
   * Regardless of whether you continue to wait, the SDK will still retry all connection failures
   * indefinitely unless it gets an unrecoverable error as described above.
   *
   * @returns
   *   A Promise that will be resolved if the client initializes successfully, or rejected if it
   *   fails. If successful, the result is the same client object.
   *
   * @example
   * This example shows use of Promise chaining methods for specifying handlers:
   * ```javascript
   *   client.waitForInitialization().then(() => {
   *     // do whatever is appropriate if initialization has succeeded
   *   }).catch(err => {
   *     // do whatever is appropriate if initialization has failed
   *   })
   * ```
   *
   * @example
   * This example shows use of `async`/`await` syntax for specifying handlers:
   * ```javascript
   *   try {
   *     await client.waitForInitialization();
   *     // do whatever is appropriate if initialization has succeeded
   *   } catch (err) {
   *     // do whatever is appropriate if initialization has failed
   *   }
   * ```
   */
  waitForInitialization(): Promise<LDClient>;

  /**
   * Determines the variation of a feature flag for a context.
   *
   * @param key The unique key of the feature flag.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result value. If omitted, you will receive
   *   a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result value.
   */
  variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void,
  ): Promise<LDFlagValue>;

  /**
   * Determines the variation of a feature flag for a context, along with information about how it
   * was calculated.
   *
   * The `reason` property of the result will also be included in analytics events, if you are
   * capturing detailed event data for this flag.
   *
   * For more information, see the [SDK reference
   * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
   *
   * @param key The unique key of the feature flag.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result (as an {@link LDEvaluationDetail}).
   *   If omitted, you will receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved with
   *   the result (as an{@link LDEvaluationDetail}).
   */
  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail>;

  /**
   * TKTK: Should use a common description.
   *
   * If the evaluated value of the flag cannot be converted to an LDMigrationStage, then an error
   * event will be raised.
   *
   * @param key The unique key of the feature flag.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param callback A Node-style callback to receive the result (as an {@link LDMigrationStage}).
   * @returns
   *   A Promise which will be resolved with the result (as an{@link LDMigrationStage}).
   */
  variationMigration(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage,
    callback?: (err: any, res: LDMigrationStage) => void
  ): Promise<LDMigrationStage>;

  /**
   * Builds an object that encapsulates the state of all feature flags for a given context.
   * This includes the flag values and also metadata that can be used on the front end. This
   * method does not send analytics events back to LaunchDarkly.
   *
   * The most common use case for this method is to bootstrap a set of client-side
   * feature flags from a back-end service. Call the `toJSON()` method of the returned object
   * to convert it to the data structure used by the client-side SDK.
   *
   * @param context
   *   The context requesting the feature flags.
   * @param options
   *   Optional {@link LDFlagsStateOptions} to determine how the state is computed.
   * @param callback
   *   A Node-style callback to receive the result (as an {@link LDFlagsState}). If omitted, you
   *   will receive a Promise instead.
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which will be resolved
   *   with the result as an {@link LDFlagsState}.
   */
  allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState | null) => void,
  ): Promise<LDFlagsState>;

  /**
   * Computes an HMAC signature of a context signed with the client's SDK key.
   *
   * For more information, see the JavaScript SDK Reference Guide on
   * [Secure mode](https://github.com/launchdarkly/js-client#secure-mode).
   *
   * @param context
   *   The context properties.
   *
   * @returns
   *   The hash string.
   */
  secureModeHash(context: LDContext): string;

  /**
   * Discards all network connections, background tasks, and other resources held by the client.
   *
   * Do not attempt to use the client after calling this method.
   */
  close(): void;

  /**
   * Tests whether the client is configured in offline mode.
   *
   * @returns
   *   True if the `offline` property is true in your {@link LDOptions}.
   */
  isOffline(): boolean;

  /**
   * Tracks that a context performed an event.
   *
   * LaunchDarkly automatically tracks pageviews and clicks that are specified in the Goals section
   * of the dashboard. This can be used to track custom goals or other events that do not currently
   * have goals.
   *
   * Note that event delivery is asynchronous, so the event may not actually be sent until later;
   * see {@link flush}.
   *
   * If the context is omitted or has no key, the client will log a warning and will not send an
   * event.
   *
   * @param key The name of the event, which may correspond to a goal in A/B tests.
   * @param context The context to track.
   * @param data Optional additional information to associate with the event.
   * @param metricValue A numeric value used by the LaunchDarkly experimentation feature in numeric
   *   custom metrics. Can be omitted if this event is used by only non-numeric metrics. This field
   *   will also be returned as part of the custom event for Data Export.
   */
  track(key: string, context: LDContext, data?: any, metricValue?: number): void;

  /**
   * Identifies a context to LaunchDarkly.
   *
   * This simply creates an analytics event that will transmit the given user properties to
   * LaunchDarkly, so that the context will be visible on your dashboard even if you have not
   * evaluated any flags for that user. It has no other effect.
   *
   * If the context is omitted or has no key, the client will log a warning
   * and will not send an event.
   *
   * @param context
   *   The context properties. Must contain at least the `key` property.
   */
  identify(context: LDContext): void;

  /**
   * Flushes all pending analytics events.
   *
   * Normally, batches of events are delivered in the background at intervals determined by the
   * `flushInterval` property of {@link LDOptions}. Calling `flush()` triggers an immediate
   * delivery. However, like Node I/O in general, this is still an asynchronous operation so you
   * must still use Promise chaining, a callback, or `async`/`await` to detect when it has finished
   * or failed.
   *
   * @param callback
   *   A function which will be called when the flush completes (meaning that all pending events
   *   have been delivered to LaunchDarkly). If omitted, you will receive a Promise instead.
   *
   * @returns
   *   If you provided a callback, then nothing. Otherwise, a Promise which resolves once
   *   flushing is finished. Note that the Promise will be rejected if the HTTP request
   *   fails, so be sure to attach a rejection handler to it.
   */
  flush(callback?: (err: Error | null, res: boolean) => void): Promise<void>;
}
