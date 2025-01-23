import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig, LDAIDefaults } from './config/LDAIConfig';

/**
 * Interface for performing AI operations using LaunchDarkly.
 */
export interface LDAIClient {
  /**
   * Retrieves and processes an AI configuration based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized messages.
   *
   * @param key The key of the AI configuration.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue A fallback value containing model configuration and messages. This will
   * be used if the configuration is not available from LaunchDarkly.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the message templates. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   *
   * @returns The AI `config`, processed `messages`, and a `tracker`. If the configuration cannot be accessed from
   * LaunchDarkly, then the return value will include information from the defaultValue. The returned `tracker` can
   * be used to track AI operation metrics (latency, token usage, etc.).
   *
   * @example
   * ```
   * const key = "welcome_prompt";
   * const context = {...};
   * const variables = {username: 'john'};
   * const defaultValue = {
   *  enabled: false,
   * };
   *
   * const result = config(key, context, defaultValue, variables);
   * // Output:
   * {
   *   enabled: true,
   *   config: {
   *     modelId: "gpt-4o",
   *     temperature: 0.2,
   *     maxTokens: 4096,
   *     userDefinedKey: "myValue",
   *   },
   *   messages: [
   *     {
   *       role: "system",
   *       content: "You are an amazing GPT."
   *     },
   *     {
   *       role: "user",
   *       content: "Explain how you're an amazing GPT."
   *     }
   *   ],
   *   tracker: ...
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
