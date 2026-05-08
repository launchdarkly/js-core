import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { initChatModel } from 'langchain/chat_models/universal';

import type {
  LDAIConfig,
  LDAIMetrics,
  LDLogger,
  LDMessage,
  LDTokenUsage,
} from '@launchdarkly/server-sdk-ai';

import type { ToolRegistry } from './LangChainAgentRunner';

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
  const parameters = { ...(aiConfig.model?.parameters || {}) };
  delete parameters.tools;

  return initChatModel(modelName, {
    ...parameters,
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
    tokens: getAIUsageFromResponse(response),
  };
}

/**
 * Extract JSON Schema from an LD tool definition's parameters.
 * Falls back to an open object schema when no parameters are defined.
 */
function getInputSchema(toolDef: Record<string, any>): Record<string, unknown> {
  const params = toolDef.function?.parameters ?? toolDef.parameters;
  if (params && typeof params === 'object' && params.properties) {
    return params;
  }
  return { type: 'object', properties: {}, additionalProperties: true };
}

/**
 * Build LangChain StructuredTool instances from LD tool definitions
 * and a ToolRegistry. Tools missing from the registry are skipped with a
 * warning. Non-function built-in tools are also skipped.
 */
export function buildStructuredTools(
  toolDefinitions: any[],
  tools: ToolRegistry,
  logger?: LDLogger,
): StructuredToolInterface[] {
  const result: StructuredToolInterface[] = [];

  for (const td of toolDefinitions) {
    if (typeof td !== 'object' || td === null) {
      continue;
    }

    const toolType: string | undefined = td.type;
    if (toolType && toolType !== 'function') {
      logger?.warn(
        `Built-in tool '${toolType}' is not reliably supported via LangChain and will be skipped. ` +
          'Use a provider-specific runner to use built-in provider tools.',
      );
      continue;
    }

    const name: string | undefined = td.name ?? td.function?.name;
    if (!name) {
      continue;
    }

    const fn = tools[name];
    if (!fn) {
      logger?.warn(
        `Tool '${name}' is defined in the AI config but was not found in ` +
          `the tool registry; skipping.`,
      );
      continue;
    }

    const rawDesc: string =
      (typeof td.description === 'string' ? td.description : '') ||
      (typeof td.function?.description === 'string' ? td.function.description : '');
    const description = rawDesc.trim() || `Tool ${name}`;

    result.push(
      tool(
        async (args: any) => {
          const res = await fn(args ?? {});
          return typeof res === 'string' ? res : JSON.stringify(res);
        },
        {
          name,
          description,
          schema: getInputSchema(td) as any,
        },
      ),
    );
  }

  return result;
}

/**
 * Extract tool-call names from a LangChain agent message list.
 */
export function extractToolCalls(messages: BaseMessage[]): string[] {
  const toolCalls: string[] = [];
  for (const msg of messages ?? []) {
    const msgToolCalls = (msg as AIMessage).tool_calls;
    if (!msgToolCalls) {
      continue;
    }
    for (const tc of msgToolCalls) {
      if (tc.name) {
        toolCalls.push(tc.name);
      }
    }
  }
  return toolCalls;
}

/**
 * Extract the string content of the last message in a list.
 */
export function extractLastMessageContent(messages: BaseMessage[]): string {
  if (messages && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (typeof last.content === 'string') {
      return last.content;
    }
  }
  return '';
}

/**
 * Sum token usage across all messages in a LangChain agent result.
 */
export function sumTokenUsageFromMessages(messages: BaseMessage[]): LDTokenUsage | undefined {
  let inputSum = 0;
  let outputSum = 0;
  let totalSum = 0;

  for (const m of messages) {
    const usage = getAIUsageFromResponse(m as AIMessage);
    if (!usage) {
      continue;
    }
    inputSum += usage.input;
    outputSum += usage.output;
    totalSum += usage.total;
  }

  if (inputSum === 0 && outputSum === 0 && totalSum === 0) {
    return undefined;
  }
  return { total: totalSum, input: inputSum, output: outputSum };
}
