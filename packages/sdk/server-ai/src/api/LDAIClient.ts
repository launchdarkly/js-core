import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgent, LDAIAgentConfig, LDAIAgentDefaults } from './agents';
import { TrackedChat } from './chat';
import { SupportedAIProvider } from './providers';
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
   * @param defaultValue A fallback value containing model configuration and instructions.
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
   * const agent = await client.agent(key, context, {
   *   enabled: true,
   *   instructions: 'You are a research assistant.',
   * }, variables);
   *
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
   * from the respective `defaultValue`. The returned `tracker` can be used to track AI operation metrics
   * (latency, token usage, etc.).
   *
   * @example
   * ```
   * const agentConfigs = [
   *   {
   *     key: 'research_agent',
   *     defaultValue: { enabled: true, instructions: 'You are a research assistant.' },
   *     variables: { topic: 'climate change' }
   *   },
   *   {
   *     key: 'writing_agent',
   *     defaultValue: { enabled: true, instructions: 'You are a writing assistant.' },
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
  agents<const T extends readonly LDAIAgentConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgent>>;

  /**
   * Initializes and returns a new TrackedChat instance for chat interactions.
   * This method serves as the primary entry point for creating TrackedChat instances from configuration.
   *
   * @param key The key identifying the AI chat configuration to use.
   * @param context The standard LDContext used when evaluating flags.
   * @param defaultValue A default value representing a standard AI chat config result.
   * @param variables Dictionary of values for instruction interpolation.
   * @returns A promise that resolves to the TrackedChat instance, or null if the configuration is disabled.
   *
   * @example
   * ```
   * const key = "customer_support_chat";
   * const context = {...};
   * const defaultValue = {
   *   config: {
   *     enabled: false,
   *     model: { name: "gpt-4" },
   *     messages: [
   *       { role: "system", content: "You are a helpful customer support agent." }
   *     ]
   *   }
   * };
   * const variables = { customerName: 'John' };
   *
   * const chat = await client.initChat(key, context, defaultValue, variables);
   * if (chat) {
   *   const response = await chat.invoke("I need help with my order");
   *   console.log(response.message.content);
   *
   *   // Access configuration and tracker if needed
   *   console.log('Model:', chat.getConfig().model?.name);
   *   chat.getTracker().trackSuccess();
   * }
   * ```
   */
  initChat(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<TrackedChat | undefined>;
}
