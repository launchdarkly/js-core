import Mustache from 'mustache';

import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { LDAIConfig } from './api/config';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';

/**
 * Interface for performing AI operations using LaunchDarkly.
 */
export interface AIClient {
  /**
   * Parses and interpolates a template string with the provided variables.
   *
   * @param template - The template string to be parsed and interpolated.
   * @param variables - An object containing the variables to be used for interpolation.
   * @returns The interpolated string.
   */
  interpolateTemplate(template: string, variables: Record<string, unknown>): string;

  /**
   * Retrieves and processes a prompt template based on the provided key, LaunchDarkly context, and
   * variables.
   *
   * @param key - A unique identifier for the prompt template. This key is used to fetch the correct
   *  prompt from storage or configuration.
   * @param context - The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the prompt is processed
   * or personalized.
   * @param variables - A map of key-value pairs representing dynamic variables to be injected into
   * the prompt template. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   * @param defaultValue - A fallback value to be used if the prompt template associated with the
   * key is not found or if any errors occur during processing.
   *
   * @returns The processed prompt after all variables have been substituted in the stored prompt
   * template. If the prompt cannot be retrieved or processed, the `defaultValue` is returned.
   *
   * @example
   * ```
   * const key = "welcome_prompt";
   * const context = {...};
   * const variables = {username: 'john'};
   * const defaultValue = {};
   *
   * const result = modelConfig(key, context, defaultValue, variables);
   * // Output:
   * {
   *   modelId: "gpt-4o",
   *   temperature: 0.2,
   *   maxTokens: 4096,
   *   userDefinedKey: "myValue",
   *   prompt: [
   *     {
   *       role: "system",
   *       content: "You are an amazing GPT."
   *     },
   *     {
   *       role: "user",
   *       content: "Explain how you're an amazing GPT."
   *     }
   *   ]
   * }
   * ```
   */
  modelConfig<T>(
    key: string,
    context: LDContext,
    defaultValue: T,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig | T>;
}

export class AIClientImpl implements AIClient {
  private _ldClient: LDClient;

  constructor(ldClient: LDClient) {
    this._ldClient = ldClient;
  }

  interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  async modelConfig<T>(
    key: string,
    context: LDContext,
    defaultValue: T,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig | T> {
    const detail = await this._ldClient.variation(key, context, defaultValue);

    const allVariables = { ldctx: context, ...variables };

    detail.value.prompt = detail.value.prompt.map((entry: any) => ({
      ...entry,
      content: this.interpolateTemplate(entry.content, allVariables),
    }));

    return {
      config: detail.value,
      // eslint-disable-next-line no-underscore-dangle
      tracker: new LDAIConfigTrackerImpl(
        this._ldClient,
        key,
        // eslint-disable-next-line no-underscore-dangle
        detail.value._ldMeta.variationId,
        context,
      ),
      noConfiguration: Object.keys(detail).length === 0,
    };
  }
}

/**
 * Initialize a new AI client. This client will be used to perform any AI operations.
 * @param ldClient The base LaunchDarkly client.
 * @returns A new AI client.
 */
export function initAi(ldClient: LDClient): AIClient {
  return new AIClientImpl(ldClient);
}

export * from './api';
