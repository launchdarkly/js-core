import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig, LDAIDefaults } from './config/LDAIConfig';

/**
 * Interface for performing AI operations using LaunchDarkly.
 */
export interface LDAIClient {
  /**
   * Parses and interpolates a template string with the provided variables.
   *
   * @param template The template string to be parsed and interpolated.
   * @param variables An object containing the variables to be used for interpolation.
   * @returns The interpolated string.
   */
  interpolateTemplate(template: string, variables: Record<string, unknown>): string;

  /**
   * Retrieves and processes an AI configuration based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the processed prompts.
   *
   * @param key The key of the AI configuration.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the prompt template. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   * @param defaultValue A fallback value containing model configuration and prompts. This will
   * be used if the configurationuration is not available from launchdarkly.
   *
   * @returns The AI configurationuration including a processed prompt after all variables have been
   * substituted in the stored prompt template. This will also include a `tracker` used to track
   * the state of the AI operation. If the configuration cannot be accessed from LaunchDarkly, then
   * the return value will include information from the defaultValue.
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
   * const result = modelConfig(key, context, defaultValue, variables);
   * // Output:
   * {
   *   enabled: true,
   *   config: {
   *     modelId: "gpt-4o",
   *     temperature: 0.2,
   *     maxTokens: 4096,
   *     userDefinedKey: "myValue",
   *   },
   *   prompt: [
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
  modelConfig(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig>;
}
