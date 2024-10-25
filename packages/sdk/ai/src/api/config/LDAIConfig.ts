import { LDAIConfigTracker } from './LDAIConfigTracker';

/**
 * AI Config value and tracker.
 */
export interface LDAIConfig {
  /**
   * The result of the AI Config customization.
   */
  config: unknown;

  /**
   * A tracker which can be used to generate analytics.
   */
  tracker: LDAIConfigTracker;

  /**
   * Whether the configuration is not found.
   */
  noConfiguration: boolean;
}
