import { LDContext } from '@launchdarkly/cloudflare-server-sdk';

import type { LDAIAgent, LDAIAgentConfig, LDAIAgentDefaults } from './agents/LDAIAgent';
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
   * const context = { kind: 'user', key: 'example-user-key', name: 'Sandy' };
   * const config = await aiClient.config(
   *   'chat-assistant',
   *   context,
   *   {},
   *   { myVariable: 'My User Defined Variable' }
   * );
   *
   * if (config.enabled) {
   *   const wc = config.toWorkersAI(env.AI);
   *   const response = await env.AI.run(wc.model, wc);
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

  /**
   * Retrieves and processes a single AI Config agent including customized instructions.
   */
  agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgent>;

  /**
   * Retrieves and processes multiple AI Config agents and returns a map of key to agent.
   */
  agents<TConfigs extends readonly LDAIAgentConfig[]>(
    agentConfigs: TConfigs,
    context: LDContext,
  ): Promise<Record<TConfigs[number]['key'], LDAIAgent>>;
}
