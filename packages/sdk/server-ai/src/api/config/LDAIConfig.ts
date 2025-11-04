import { LDAIConfigTracker } from './LDAIConfigTracker';
import { VercelAISDKConfig, VercelAISDKMapOptions, VercelAISDKProvider } from './VercelAISDK';

/**
 * Configuration related to the model.
 */
export interface LDModelConfig {
  /**
   * The ID of the model.
   */
  name: string;

  /**
   * Model specific parameters.
   */
  parameters?: { [index: string]: unknown };

  /**
   * Additional user-specified parameters.
   */
  custom?: { [index: string]: unknown };
}

export interface LDProviderConfig {
  /**
   * The name of the provider.
   */
  name: string;
}

/**
 * Information about prompts.
 */
export interface LDMessage {
  /**
   * The role of the prompt.
   */
  role: 'user' | 'assistant' | 'system';
  /**
   * Content for the prompt.
   */
  content: string;
}

/**
 * AI Config and tracker.
 */
export interface LDAIConfig {
  /**
   * Optional model configuration.
   */
  model?: LDModelConfig;
  /**
   * Optional prompt data.
   */
  messages?: LDMessage[];

  /**
   * Optional configuration for the provider.
   */
  provider?: LDProviderConfig;

  /**
   * A tracker which can be used to generate analytics.
   */
  tracker: LDAIConfigTracker;

  /**
   * Whether the configuration is enabled.
   */
  enabled: boolean;

  /**
   * Maps this AI config to a format usable direcly in Vercel AI SDK generateText()
   * and streamText() methods.
   *
   * WARNING: this method can throw an exception if a Vercel AI SDK model cannot be determined.
   *
   * @deprecated Use `VercelProvider.toVercelAISDK()` from the `@launchdarkly/server-sdk-ai-vercel` package instead.
   * This method will be removed in a future version.
   *
   * @param provider A Vercel AI SDK Provider or a map of provider names to Vercel AI SDK Providers.
   * @param options Optional mapping options.
   * @returns A configuration directly usable in Vercel AI SDK generateText() and streamText()
   * @throws {Error} if a Vercel AI SDK model cannot be determined from the given provider parameter.
   */
  toVercelAISDK: <TMod>(
    provider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
    options?: VercelAISDKMapOptions | undefined,
  ) => VercelAISDKConfig<TMod>;
}

/**
 * Default value for a `modelConfig`. This is the same as the LDAIConfig, but it does not include
 * a tracker or mapper, and `enabled` is optional.
 */
export type LDAIDefaults = Omit<LDAIConfig, 'tracker' | 'enabled' | 'toVercelAISDK'> & {
  /**
   * Whether the configuration is enabled.
   *
   * defaults to false
   */
  enabled?: boolean;
};
