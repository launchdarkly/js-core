import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import type { LDAIMetrics, LDMessage, LDTokenUsage } from '@launchdarkly/server-sdk-ai';

/**
 * Convert LaunchDarkly messages to LangChain message instances.
 *
 * @param messages Array of LDMessage objects
 * @returns Array of LangChain message instances (HumanMessage, SystemMessage, AIMessage)
 */
export function convertMessagesToLangChain(
  messages: LDMessage[],
): (HumanMessage | SystemMessage | AIMessage)[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'system':
        return new SystemMessage(msg.content);
      case 'user':
        return new HumanMessage(msg.content);
      case 'assistant':
        return new AIMessage(msg.content);
      default:
        throw new Error(`Unsupported message role: ${msg.role}`);
    }
  });
}

/**
 * Map LaunchDarkly provider names to LangChain `modelProvider` strings.
 *
 * LangChain uses different provider identifiers than LaunchDarkly's
 * standardized names; this helper applies the known translations.
 */
export function mapProviderName(ldProviderName: string): string {
  const lowercasedName = ldProviderName.toLowerCase();
  const mapping: Record<string, string> = {
    gemini: 'google-genai',
  };
  return mapping[lowercasedName] || lowercasedName;
}

/**
 * Extract token usage from a LangChain AIMessage response.
 */
export function getAIUsageFromResponse(response: AIMessage): LDTokenUsage | undefined {
  if (!response?.usage_metadata) {
    return undefined;
  }
  return {
    total: response.usage_metadata.total_tokens,
    input: response.usage_metadata.input_tokens,
    output: response.usage_metadata.output_tokens,
  };
}

/**
 * Get AI metrics from a LangChain provider response.
 */
export function getAIMetricsFromResponse(response: AIMessage): LDAIMetrics {
  return {
    success: true,
    usage: getAIUsageFromResponse(response),
  };
}
