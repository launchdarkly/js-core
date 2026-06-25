import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { ManagedAgent } from './ManagedAgent';
import { ManagedModel } from './ManagedModel';
import {
  LDAIAgentConfig,
  LDAIAgentConfigDefault,
  LDAIAgentRequestConfig,
  LDAICompletionConfig,
  LDAICompletionConfigDefault,
  LDAIConfigTracker,
  LDAIJudgeConfig,
  LDAIJudgeConfigDefault,
} from './config';
import { AgentGraphDefinition, LDGraphTracker } from './graph';
import { Judge } from './judge/Judge';
import { SupportedAIProvider } from './providers';

/**
 * Interface for performing AI operations using LaunchDarkly.
 */
export interface LDAIClient {
  /**
   * Retrieves and processes a completion AI Config based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized messages.
   *
   * @param key The key of the AI Config.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the message content. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   *
   * @returns An {@link LDAICompletionConfig} with `enabled`, `model`, `provider`,
   * `messages`, and a `createTracker()` factory. Call `createTracker()` on the
   * returned config to obtain a tracker for each AI run. If the configuration
   * cannot be accessed from LaunchDarkly, the return value will include
   * information from the `defaultValue`.
   *
   * @example
   * ```
   * const key = "welcome_prompt";
   * const context = {...};
   * const variables = {username: 'john'};
   * const defaultValue = {
   *  enabled: true,
   *  model: { name: 'gpt-4' },
   *  provider: { name: 'openai' },
   * };
   *
   * const completionConfig = await client.completionConfig(key, context, defaultValue, variables);
   * if (completionConfig.enabled) {
   *   const tracker = completionConfig.createTracker();
   *   // Use completionConfig.messages and completionConfig.model with your LLM,
   *   // then record metrics with tracker.trackSuccess(), tracker.trackTokens(), etc.
   * }
   * ```
   */
  completionConfig(
    key: string,
    context: LDContext,
    defaultValue?: LDAICompletionConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<LDAICompletionConfig>;

  /**
   * Retrieves a completion AI Config with Mustache placeholders left intact (no interpolation).
   * Useful for displaying prompt previews or storing templates for later rendering.
   *
   * @param key The key of the AI Config.
   * @param context The LaunchDarkly context object.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   *
   * @returns An {@link LDAICompletionConfig} identical to {@link completionConfig} except that
   * `messages[].content` strings are stored verbatim from the flag variation — Mustache
   * placeholders such as `{{variable}}` are preserved.
   */
  completionConfigTemplate(
    key: string,
    context: LDContext,
    defaultValue?: LDAICompletionConfigDefault,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<LDAICompletionConfig>;

  /**
   * Retrieves an agent AI Config with Mustache placeholders left intact (no interpolation).
   * Useful for auditing instruction templates or building UI previews.
   *
   * @param key The key of the AI Config agent.
   * @param context The LaunchDarkly context object.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   *
   * @returns An {@link LDAIAgentConfig} identical to {@link agentConfig} except that
   * the `instructions` string is stored verbatim from the flag variation — Mustache
   * placeholders such as `{{topic}}` are preserved.
   */
  agentConfigTemplate(
    key: string,
    context: LDContext,
    defaultValue?: LDAIAgentConfigDefault,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<LDAIAgentConfig>;

  /**
   * Retrieves a judge AI Config with Mustache placeholders left intact (no interpolation).
   * Useful for auditing judge prompt templates.
   *
   * @param key The key of the Judge AI Config.
   * @param context The LaunchDarkly context object.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   *
   * @returns An {@link LDAIJudgeConfig} identical to {@link judgeConfig} except that
   * `messages[].content` strings are stored verbatim from the flag variation — Mustache
   * placeholders are preserved.
   */
  judgeConfigTemplate(
    key: string,
    context: LDContext,
    defaultValue?: LDAIJudgeConfigDefault,
  ): Promise<LDAIJudgeConfig>;

  /**
   * Retrieves and processes a single AI Config agent based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized instructions.
   *
   * @param key The key of the AI Config agent.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   * @param variables A map of key-value pairs representing dynamic variables to be injected into
   * the instructions. The keys correspond to placeholders within the template, and the values
   * are the corresponding replacements.
   *
   * @returns An {@link LDAIAgentConfig} with customized `instructions`, `model`,
   * `provider`, and a `createTracker()` factory. Call `createTracker()` on the
   * returned config to obtain a tracker for each AI run. If the configuration
   * cannot be accessed from LaunchDarkly, the return value will include
   * information from the `defaultValue`.
   *
   * @example
   * ```
   * const key = "research_agent";
   * const context = {...};
   * const variables = { topic: 'climate change' };
   * const agentConfig = await client.agentConfig(key, context, {
   *   enabled: true,
   *   model: { name: 'gpt-4' },
   *   provider: { name: 'openai' },
   *   instructions: 'You are a research assistant.',
   * }, variables);
   *
   * if (agentConfig.enabled) {
   *   const tracker = agentConfig.createTracker();
   *   const researchResult = agentConfig.instructions; // Interpolated instructions
   *   tracker.trackSuccess();
   * }
   * ```
   */
  agentConfig(
    key: string,
    context: LDContext,
    defaultValue?: LDAIAgentConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<LDAIAgentConfig>;

  /**
   * Retrieves and processes a Judge AI Config based on the provided key, LaunchDarkly context,
   * and variables. This includes the model configuration and the customized messages for evaluation.
   *
   * @param key The key of the Judge AI Config.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   * @param variables Optional variables for template interpolation in messages and instructions.
   * @returns A promise that resolves to an {@link LDAIJudgeConfig} with `enabled`,
   * `model`, `provider`, `messages`, `evaluationMetricKey`, and a `createTracker()`
   * factory. Call `createTracker()` on the returned config to obtain a tracker for
   * each AI run.
   *
   * @example
   * ```typescript
   * const judgeConf = await client.judgeConfig(key, context, {
   *   enabled: true,
   *   model: { name: 'gpt-4' },
   *   provider: { name: 'openai' },
   *   evaluationMetricKey: '$ld:ai:judge:relevance',
   *   messages: [{ role: 'system', content: 'You are a relevance judge.' }]
   * }, variables);
   *
   * if (judgeConf.enabled) {
   *   const tracker = judgeConf.createTracker();
   *   // Use judgeConf.messages and judgeConf.model with your LLM,
   *   // then record metrics with tracker.trackSuccess(), tracker.trackJudgeResult(), etc.
   * }
   * ```
   */
  judgeConfig(
    key: string,
    context: LDContext,
    defaultValue?: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIJudgeConfig>;

  /**
   * Retrieves and processes multiple AI Config agents based on the provided agent configurations
   * and LaunchDarkly context. This includes the model configuration and the customized instructions.
   *
   * @param agentConfigs An array of agent configurations, each containing the agent key, optional default
   * configuration (when omitted or null, a disabled default is used), and variables for instructions interpolation.
   * @param context The LaunchDarkly context object that contains relevant information about the
   * current environment, user, or session. This context may influence how the configuration is
   * processed or personalized.
   *
   * @returns A map of agent keys to their respective {@link LDAIAgentConfig}s,
   * each with customized `instructions` and a `createTracker()` factory. Call
   * `createTracker()` on a returned config to obtain a tracker for each AI run.
   * If a configuration cannot be accessed from LaunchDarkly, the return value
   * will include information from the respective `defaultValue`.
   *
   * @example
   * ```
   * const agentConfigsList = [
   *   {
   *     key: 'research_agent',
   *     defaultValue: {
   *       enabled: true,
   *       model: { name: 'gpt-4' },
   *       provider: { name: 'openai' },
   *       instructions: 'You are a research assistant.'
   *     },
   *     variables: { topic: 'climate change' }
   *   },
   *   {
   *     key: 'writing_agent',
   *     defaultValue: {
   *       enabled: true,
   *       model: { name: 'gpt-4' },
   *       provider: { name: 'openai' },
   *       instructions: 'You are a writing assistant.'
   *     },
   *     variables: { style: 'academic' }
   *   }
   * ] as const;
   * const context = {...};
   *
   * const configs = await client.agentConfigs(agentConfigsList, context);
   * if (configs["research_agent"].enabled) {
   *   const tracker = configs["research_agent"].createTracker();
   *   const researchResult = configs["research_agent"].instructions; // Interpolated instructions
   *   tracker.trackSuccess();
   * }
   * ```
   */
  agentConfigs<const T extends readonly LDAIAgentRequestConfig[]>(
    agentConfigs: T,
    context: LDContext,
  ): Promise<Record<T[number]['key'], LDAIAgentConfig>>;

  /**
   * Creates and returns a new ManagedModel instance for LLM model interactions.
   *
   * @param key The key identifying the AI completion configuration to use.
   * @param context The standard LDContext used when evaluating flags.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   * @param variables Dictionary of values for instruction interpolation.
   * The variables will also be used for judge evaluation. For the judge only, the variables
   * `message_history` and `response_to_evaluate` are reserved and will be ignored.
   * @param defaultAiProvider Optional default AI provider to use.
   * @returns A promise that resolves to the ManagedModel instance, or undefined if the configuration is disabled.
   *
   * @example
   * ```
   * const key = "customer_support_chat";
   * const context = {...};
   * const defaultValue = {
   *   enabled: true,
   *   model: { name: "gpt-4" },
   *   provider: { name: "openai" },
   *   messages: [
   *     { role: "system", content: "You are a helpful customer support agent." }
   *   ]
   * };
   * const variables = { customerName: 'John' };
   *
   * const model = await client.createModel(key, context, defaultValue, variables);
   * if (model) {
   *   const result = await model.run("I need help with my order");
   *   console.log(result.content);
   * }
   * ```
   */
  createModel(
    key: string,
    context: LDContext,
    defaultValue?: LDAICompletionConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<ManagedModel | undefined>;

  /**
   * Creates and returns a new ManagedAgent instance for agent interactions.
   * Evaluations are wired automatically and exposed on ManagedResult.evaluations.
   *
   * @param key The key identifying the agent AI config to use.
   * @param context The standard LDContext used when evaluating flags.
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * @param variables Dictionary of values for instruction interpolation.
   * @param defaultAiProvider Optional default AI provider to use.
   * @returns A promise that resolves to the ManagedAgent instance, or undefined if disabled.
   */
  createAgent(
    key: string,
    context: LDContext,
    defaultValue?: LDAIAgentConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
  ): Promise<ManagedAgent | undefined>;

  /**
   * Creates and returns a new Judge instance for AI evaluation.
   *
   * @param key The key identifying the AI judge configuration to use
   * @param context Standard LDContext used when evaluating flags
   * @param defaultValue Optional fallback when the configuration is not available from LaunchDarkly.
   * When omitted or null, a disabled default is used.
   * @param variables Dictionary of values for instruction interpolation.
   * The variables `message_history` and `response_to_evaluate` are reserved for the judge and will be ignored.
   * @param defaultAiProvider Optional default AI provider to use.
   * @param sampleRate Optional default sampling rate (0-1) baked into the Judge.
   *   Used by `Judge.evaluate()` when no per-call rate is supplied. Defaults to 1.0.
   * @returns Promise that resolves to a Judge instance or undefined if disabled/unsupported
   *
   * @example
   * ```
   * const judge = await client.createJudge(
   *   "relevance-judge",
   *   context,
   *   {
   *     enabled: true,
   *     model: { name: "gpt-4" },
   *     provider: { name: "openai" },
   *     evaluationMetricKey: '$ld:ai:judge:relevance',
   *     messages: [{ role: 'system', content: 'You are a relevance judge.' }]
   *   },
   *   { metric: "relevance" }
   * );
   *
   * if (judge) {
   *   const result = await judge.evaluate("User question", "AI response");
   *   console.log('Relevance score:', result.evals.relevance?.score);
   * }
   * ```
   */
  createJudge(
    key: string,
    context: LDContext,
    defaultValue?: LDAIJudgeConfigDefault,
    variables?: Record<string, unknown>,
    defaultAiProvider?: SupportedAIProvider,
    sampleRate?: number,
  ): Promise<Judge | undefined>;

  /**
   * Reconstructs an AIConfigTracker from a resumption token string previously
   * obtained from a tracker's `resumptionToken` property. Use this to associate
   * deferred events (such as user feedback) with the original tracker's runId.
   *
   * @param token A URL-safe Base64-encoded resumption token string.
   * @param context The evaluation context to use for subsequent track calls.
   * @returns A reconstructed AIConfigTracker with the original runId preserved.
   */
  createTracker(token: string, context: LDContext): LDAIConfigTracker;

  /**
   * Fetches an agent graph configuration from LaunchDarkly and returns an
   * {@link AgentGraphDefinition}.
   *
   * When the graph is enabled the method validates that:
   * - The graph flag can be evaluated.
   * - A single root node is present.
   * - All nodes in the graph are reachable from the root (no disconnected nodes).
   * - Every referenced agent config can be fetched and is enabled.
   *
   * If any validation check fails, the returned definition has
   * {@link AgentGraphDefinition.enabled | enabled} set to `false` with an empty
   * node collection. When the logger level is DEBUG, a message describing the
   * failure is emitted.
   *
   * @param graphKey The LaunchDarkly flag key for the agent graph configuration.
   * @param context The LaunchDarkly context used for flag evaluation and tracking.
   * @param variables Optional key-value pairs used for Mustache template interpolation
   *   in each node's agent config instructions. Applied uniformly to all nodes.
   *
   * @returns A promise that resolves to an {@link AgentGraphDefinition}. Check
   *   {@link AgentGraphDefinition.enabled | enabled} before traversing.
   *
   * @example
   * ```typescript
   * const graph = await aiClient.agentGraph('my-agent-graph', context, { userName: 'Sandy' });
   * if (graph.enabled) {
   *   graph.traverse((node, ctx) => {
   *     // build your provider-specific node here
   *   });
   * }
   * ```
   */
  agentGraph(
    graphKey: string,
    context: LDContext,
    variables?: Record<string, unknown>,
  ): Promise<AgentGraphDefinition>;

  /**
   * Reconstructs an {@link LDGraphTracker} from a resumption token, preserving
   * the original `runId` so events from a resumed session are correlated correctly.
   *
   * **Security note:** The token encodes the flag variation key and version.
   * Keep it server-side; do not expose it to untrusted clients.
   *
   * @param token URL-safe Base64-encoded token from {@link LDGraphTracker.resumptionToken}.
   * @param context LDContext to associate with the reconstructed tracker.
   */
  createGraphTracker(token: string, context: LDContext): LDGraphTracker;
}
