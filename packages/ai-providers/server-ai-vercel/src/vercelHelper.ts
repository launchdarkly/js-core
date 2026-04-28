import type { LDAIMetrics, LDMessage, LDTokenUsage } from '@launchdarkly/server-sdk-ai';

import type { ModelUsageTokens, StreamResponse, TextResponse } from './types';

/**
 * Convert LaunchDarkly messages to the Vercel AI SDK message format.
 *
 * The Vercel AI SDK accepts the same `{ role, content }` shape that LDMessage
 * uses, so this helper currently performs a structural pass-through. Having
 * an explicit helper keeps the call sites consistent across providers and
 * gives us a single place to adapt if Vercel's message shape diverges.
 */
export function convertMessagesToVercel(messages: LDMessage[]): LDMessage[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

/**
 * Map LaunchDarkly provider names to Vercel AI SDK provider identifiers.
 */
export function mapProviderName(ldProviderName: string): string {
  const lowercasedName = ldProviderName.toLowerCase();
  const mapping: Record<string, string> = {
    gemini: 'google',
  };
  return mapping[lowercasedName] || lowercasedName;
}

/**
 * Map Vercel AI SDK usage data to LaunchDarkly token usage.
 * Supports both v4 (promptTokens/completionTokens) and v5
 * (inputTokens/outputTokens) field names.
 */
export function mapUsageDataToLDTokenUsage(usageData: ModelUsageTokens): LDTokenUsage {
  const { totalTokens, inputTokens, outputTokens, promptTokens, completionTokens } = usageData;
  return {
    total: totalTokens ?? 0,
    input: inputTokens ?? promptTokens ?? 0,
    output: outputTokens ?? completionTokens ?? 0,
  };
}

/**
 * Get AI metrics from a Vercel AI SDK text response (e.g., generateText).
 * Supports both v4 and v5 token field names.
 */
export function getAIMetricsFromResponse(response: TextResponse): LDAIMetrics {
  const finishReason = response?.finishReason ?? 'unknown';

  let usage: LDTokenUsage | undefined;
  if (response?.totalUsage) {
    usage = mapUsageDataToLDTokenUsage(response.totalUsage);
  } else if (response?.usage) {
    usage = mapUsageDataToLDTokenUsage(response.usage);
  }

  return {
    success: finishReason !== 'error',
    usage,
  };
}

/**
 * Get AI metrics from a Vercel AI SDK streaming result.
 *
 * Awaits the stream's terminal promises and prefers `totalUsage` over
 * `usage` for cumulative usage across all steps.
 */
export async function getAIMetricsFromStream(stream: StreamResponse): Promise<LDAIMetrics> {
  const finishReason = (await stream.finishReason?.catch(() => 'error')) ?? 'unknown';

  let usage: LDTokenUsage | undefined;

  if (stream.totalUsage) {
    const usageData = await stream.totalUsage.catch(() => undefined);
    if (usageData) {
      usage = mapUsageDataToLDTokenUsage(usageData);
    }
  }

  if (!usage && stream.usage) {
    const usageData = await stream.usage.catch(() => undefined);
    if (usageData) {
      usage = mapUsageDataToLDTokenUsage(usageData);
    }
  }

  return {
    success: finishReason !== 'error',
    usage,
  };
}
