import Mustache from 'mustache';

import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

enum FeedbackKind {
  Positive = 'positive',
  Negative = 'negative',
}

export interface TokenMetrics {
  total: number;
  input: number;
  output: number;
}

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
   * const key = "welcome_prompt";
   * const context = new LDContext(...);
   * const variables = new Record<string, string>([["username", "John"]]);
   * const defaultValue = "Welcome, user!";
   *
   * const result = modelConfig(key, context, variables, defaultValue);
   * console.log(result);
   * // Output:
   * // {
   * // modelId: "gpt-4o",
   * // temperature: 0.2,
   * // maxTokens: 4096,
   * // userDefinedKey: "myValue",
   * // prompt: [
   * // {
   * // role: "system",
   * // content: "You are an amazing GPT."
   * // },
   * // {
   * // role: "user",
   * // content: "Explain how you're an amazing GPT."
   * // }
   * // ]
   * // }
   */
  async modelConfig(
    key: string,
    context: LDContext,
    defaultValue: string,
    variables?: Record<string, unknown>,
  ): Promise<any> {
    const detail = await this.ldClient.variationDetail(key, context, defaultValue);

    const allVariables = { ldctx: context, ...variables };

    detail.value.prompt = detail.value.prompt.map((entry: any) => ({
      ...entry,
      content: this.interpolateTemplate(entry.content, allVariables),
    }));

    return detail.value;
  }

  trackDuration(context: LDContext, duration: number) {
    this.ldClient.track('$ld:ai:duration:total', context, duration);
  }

  trackTokens(context: LDContext, tokens: TokenMetrics) {
    if (tokens.total > 0) {
      this.ldClient.track('$ld:ai:tokens:total', context, null, tokens.total);
    }
    if (tokens.input > 0) {
      this.ldClient.track('$ld:ai:tokens:input', context, null, tokens.input);
    }
    if (tokens.output > 0) {
      this.ldClient.track('$ld:ai:tokens:output', context, null, tokens.output);
    }
  }

  trackError(context: LDContext, error: number) {
    this.ldClient.track('$ld:ai:error', context, null, error);
  }

  trackGeneration(context: LDContext, generation: number) {
    this.ldClient.track('$ld:ai:generation', context, null, generation);
  }

  trackFeedback(context: LDContext, feedback: { kind: FeedbackKind }) {
    if (feedback.kind === FeedbackKind.Positive) {
      this.ldClient.track('$ld:ai:feedback:user:positive', context, null, 1);
    } else if (feedback.kind === FeedbackKind.Negative) {
      this.ldClient.track('$ld:ai:feedback:user:negative', context, null, 1);
    }
  }
}

export function init(ldClient: LDClient): AIClient {
  return new AIClient(ldClient);
}

export interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export interface UnderscoreTokenUsage {
  completion_tokens?: number;
  prompt_tokens?: number;
  total_tokens?: number;
}

export function openAiUsageToTokenMetrics(usage: TokenUsage | UnderscoreTokenUsage): TokenMetrics {
  return {
    total: 'total_tokens' in usage ? usage.total_tokens : (usage as TokenUsage).totalTokens ?? 0,
    input: 'prompt_tokens' in usage ? usage.prompt_tokens : (usage as TokenUsage).promptTokens ?? 0,
    output:
      'completion_tokens' in usage
        ? usage.completion_tokens
        : (usage as TokenUsage).completionTokens ?? 0,
  };
}
