import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { initChatModel } from 'langchain/chat_models/universal';

import type { LDAIConfig, LDAIMetrics, LDMessage, LDTokenUsage } from '@launchdarkly/server-sdk-ai';

/**
 * Convert LaunchDarkly messages to LangChain message instances.
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
 * Create a LangChain chat model from a LaunchDarkly AI configuration.
 */
export async function createLangChainModel(aiConfig: LDAIConfig): Promise<BaseChatModel> {
  const modelName = aiConfig.model?.name || '';
  const provider = aiConfig.provider?.name || '';
  const parameters = aiConfig.model?.parameters || {};

  return initChatModel(modelName, {
    ...parameters,
    modelProvider: mapProviderName(provider),
  });
}

/**
 * Map LaunchDarkly provider names to LangChain `modelProvider` strings.
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
