import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type { LDAIConfig, LDAIDefaults } from './config/LDAIConfig';

/**
 * Interface for performing AI operations with LaunchDarkly.
 */
export interface LDAIClient {
  /**
   * Retrieves and processes an AI configuration from LaunchDarkly.
   *
   * @param key The key of the AI configuration in LaunchDarkly.
   * @param context The LaunchDarkly context for evaluation.
   * @param defaultValue Fallback configuration if LaunchDarkly is unavailable.
   * @param variables Variables for template interpolation in messages.
   * @returns The AI configuration with tracker and conversion methods.
   *
   * @example
   * ```typescript
   * const config = await aiClient.config(
   *   'chat-assistant',
   *   { kind: 'user', key: 'user-123' },
   *   { enabled: false },
   *   { username: 'Alice' }
   * );
   *
   * if (config.enabled) {
   *   const cfConfig = config.toCloudflareWorkersAI();
   *   const response = await env.AI.run(cfConfig.model, cfConfig);
   *   config.tracker.trackSuccess();
   * }
   * ```
   */
  config(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig>;
}
