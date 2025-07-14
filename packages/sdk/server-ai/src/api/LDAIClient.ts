import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgent, LDAIAgentConfig, LDAIAgentDefaults } from './agents';
import { LDAIConfig, LDAIDefaults } from './config/LDAIConfig';

/**
 * Interface for performing AI operations using LaunchDarkly.
 */
export interface LDAIClient {
  /**
   * Retrieves and processes an AI Config based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized messages.
   *
   * @param key The key of the AI Config.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue A fallback value containing model configuration and messages. This will
   * be used if the configuration is not available from LaunchDarkly.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the message content. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   *
   * @returns The AI `config`, customized `messages`, and a `tracker`. If the configuration cannot be accessed from
   * LaunchDarkly, then the return value will include information from the `defaultValue`. The returned `tracker` can
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

  /**
   * Retrieves and processes a single AI Config agent based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized instructions.
   *
   * @param key The key of the AI Config agent.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue A fallback value containing model configuration and instructions. This will
   * be used if the configuration is not available from LaunchDarkly.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the instructions. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   *
   * @returns An AI agent with customized `instructions` and a `tracker`. If the configuration
   * cannot be accessed from LaunchDarkly, then the return value will include information from the
   * `defaultValue`. The returned `tracker` can be used to track AI operation metrics (latency, token usage, etc.).
   *
   * @example
   * ```
   * const key = "research_agent";
   * const context = {...};
   * const variables = { topic: 'climate change' };
   * const defaultValue = {
   *   enabled: true,
   *   instructions: 'You are a research assistant.',
   * };
   *
   * const agent = await client.agent(key, context, defaultValue, variables);
   * const researchResult = agent.instructions; // Interpolated instructions
   * agent.tracker.trackSuccess();
   * ```
   */
  agent(
    key: string,
    context: LDContext,
    defaultValue: LDAIAgentDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIAgent>;

  /**
   * Retrieves and processes multiple AI Config agents based on the provided agent configurations
   * and LaunchDarkly context. This includes the model configuration and the customized instructions.
   *
   * @param agentConfigs An array of agent configurations, each containing the agent key, default configuration,
   * and variables for instructions interpolation.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   *
   * @returns A map of agent keys to their respective AI agents with customized `instructions` and `tracker`.
   * If a configuration cannot be accessed from LaunchDarkly, then the return value will include information
   * from the respective `defaultConfig`. The returned `tracker` can be used to track AI operation metrics
   * (latency, token usage, etc.).
   *
   * @example
   * ```
   * const agentConfigs: LDAIAgentConfig[] = [
   *   {
   *     agentKey: 'research_agent',
   *     defaultConfig: { enabled: true, instructions: 'You are a research assistant.' },
   *     variables: { topic: 'climate change' }
   *   },
   *   {
   *     agentKey: 'writing_agent',
   *     defaultConfig: { enabled: true, instructions: 'You are a writing assistant.' },
   *     variables: { style: 'academic' }
   *   }
   * ] as const;
   * const context = {...};
   *
   * const agents = await client.agents(agentConfigs, context);
   * const researchResult = agents["research_agent"].instructions; // Interpolated instructions
   * agents["research_agent"].tracker.trackSuccess();
   * ```
   */
  agents<const TConfigs extends readonly LDAIAgentConfig[]>(
    agentConfigs: TConfigs,
    context: LDContext,
  ): Promise<Record<TConfigs[number]['agentKey'], LDAIAgent>>;
}
