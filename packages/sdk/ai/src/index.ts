import Mustache from 'mustache';

import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { LDAIConfig } from './api/config';
import { LDAIConfigTracker } from './api/config/LDAIConfigTracker';

export class AIClient {
  private ldClient: LDClient;

  constructor(ldClient: LDClient) {
    this.ldClient = ldClient;
  }

  /**
   * Parses and interpolates a template string with the provided variables.
   *
   * @param template - The template string to be parsed and interpolated.
   * @param variables - An object containing the variables to be used for interpolation.
   * @returns The interpolated string.
   */
  interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  /**
   * Retrieves and processes a prompt template based on the provided key, LaunchDarkly context, and variables.
   *
   * @param key - A unique identifier for the prompt template. This key is used to fetch the correct prompt from storage or configuration.
   * @param context - The LaunchDarkly context object that contains relevant information about the current environment, user, or session. This context may influence how the prompt is processed or personalized.
   * @param variables - A map of key-value pairs representing dynamic variables to be injected into the prompt template. The keys correspond to placeholders within the template, and the values are the corresponding replacements.
   * @param defaultValue - A fallback value to be used if the prompt template associated with the key is not found or if any errors occur during processing.
   *
   * @returns The processed prompt after all variables have been substituted in the stored prompt template. If the prompt cannot be retrieved or processed, the `defaultValue` is returned.
   *
   * @example
   * ```
   * const key = "welcome_prompt";
   * const context = new LDContext(...);
   * const variables = new Record<string, string>([["username", "John"]]);
   * const defaultValue = {}};
   *
   * const result = modelConfig(key, context, defaultValue, variables);
   * // Output:
   * {
   * modelId: "gpt-4o",
   * temperature: 0.2,
   * maxTokens: 4096,
   * userDefinedKey: "myValue",
   * prompt: [
   * {
   * role: "system",
   * content: "You are an amazing GPT."
   * },
   * {
   * role: "user",
   * content: "Explain how you're an amazing GPT."
   * }
   * ]
   * }
   * ```
   */
  async modelConfig(
    key: string,
    context: LDContext,
    defaultValue: string,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig> {
    const detail = await this.ldClient.variation(key, context, defaultValue);

    const allVariables = { ldctx: context, ...variables };

    detail.value.prompt = detail.value.prompt.map((entry: any) => ({
      ...entry,
      content: this.interpolateTemplate(entry.content, allVariables),
    }));

    return {
      config: detail.value,
      tracker: new LDAIConfigTracker(
        this.ldClient,
        key,
        // eslint-disable-next-line @typescript-eslint/dot-notation
        detail.value['_ldMeta'].variationId,
        context,
      ),
      noConfiguration: Object.keys(detail).length === 0,
    };
  }
}

export function init(ldClient: LDClient): AIClient {
  return new AIClient(ldClient);
}

export * from './api/config/LDAIConfigTracker';
export * from './api/metrics';
