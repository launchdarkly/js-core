import type { LDContext, LDEvaluationDetail, LDFlagValue } from '@launchdarkly/js-sdk-common';

/**
 * The minimal LDClient contract required by the OpenFeature provider.
 * Any LaunchDarkly server-side LDClient should satisfy this interface.
 */
export interface OpenFeatureLDClientContract {
  /**
   * Evaluate a flag and return the value along with details of how it was
   * calculated.
   *
   * @param key The unique key of the feature flag.
   * @param context The context to evaluate the flag against.
   * @param defaultValue The value to return if the flag cannot be evaluated.
   * @returns A promise which resolves to the evaluation detail.
   */
  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
  ): Promise<LDEvaluationDetail>;

  /**
   * Wait for the underlying client to finish initialization.
   *
   * @param options Optional initialization options. The `timeout` field is
   *   the maximum number of seconds to wait.
   */
  waitForInitialization(options?: { timeout: number }): Promise<unknown>;

  /**
   * Flush any pending analytics events to LaunchDarkly. Called by the provider
   * during {@link Provider.onClose}.
   */
  flush(): Promise<void>;

  /**
   * Shut down the client and release any resources it holds. Called by the
   * provider during {@link Provider.onClose} after {@link flush}.
   */
  close(): void;

  /**
   * Track a custom event for the given context.
   *
   * @param key The name of the event.
   * @param context The context to associate with the event.
   * @param data Optional additional information to attach to the event.
   * @param metricValue Optional numeric metric value to associate with the
   *   event.
   */
  track(key: string, context: LDContext, data?: any, metricValue?: number): void;
}
