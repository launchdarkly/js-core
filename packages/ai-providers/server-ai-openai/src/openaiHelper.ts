import type { LDAIMetrics, LDMessage, LDTokenUsage } from '@launchdarkly/server-sdk-ai';

/**
 * OpenAI chat completion message format.
 * Mirrors the relevant subset of OpenAI's `ChatCompletionMessageParam`.
 */
export interface OpenAIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Convert LaunchDarkly messages to OpenAI chat completion message format.
 *
 * @param messages Array of LDMessage objects
 * @returns Array of OpenAI ChatCompletionMessageParam-compatible objects
 */
export function convertMessagesToOpenAI(messages: LDMessage[]): OpenAIChatMessage[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

/**
 * Extract token usage from an OpenAI response.
 *
 * @param response An OpenAI chat completions response
 * @returns LDTokenUsage or undefined if unavailable
 */
export function getAIUsageFromResponse(response: any): LDTokenUsage | undefined {
  if (!response?.usage) {
    return undefined;
  }
  const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
  return {
    total: total_tokens || 0,
    input: prompt_tokens || 0,
    output: completion_tokens || 0,
  };
}

/**
 * Get AI metrics from an OpenAI response.
 *
 * @param response The response from OpenAI chat completions API
 * @returns LDAIMetrics with success status and token usage
 */
export function getAIMetricsFromResponse(response: any): LDAIMetrics {
  return {
    success: true,
    usage: getAIUsageFromResponse(response),
  };
}
