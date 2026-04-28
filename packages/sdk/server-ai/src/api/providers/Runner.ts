import { LDMessage } from '../config/types';
import { AgentGraphRunnerResult } from '../graph/types';
import { RunnerResult } from '../model/types';

/**
 * Runner protocol for AI model providers.
 *
 * Providers implementing the Runner interface can be used with ManagedModel
 * and ManagedAgent without extending the deprecated AIProvider abstract class.
 *
 * A single Runner interface covers both chat (completion) and agent use cases.
 * For structured output (e.g., judge evaluation), pass an `outputType` schema
 * and access the parsed result via `RunnerResult.parsed`.
 */
export interface Runner {
  /**
   * Invoke the model with an array of messages.
   *
   * @param input Array of LDMessage objects representing the conversation or prompt.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the model should return structured data accessible via `RunnerResult.parsed`.
   * @returns Promise resolving to a RunnerResult.
   */
  run(input: LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult>;
}

/**
 * Runner protocol for agent graph providers.
 *
 * Providers implementing AgentGraphRunner can execute an entire agent graph
 * and return a structured AgentGraphRunnerResult.
 */
export interface AgentGraphRunner {
  /**
   * Execute the agent graph with the given input.
   *
   * @param input The user input to process through the graph.
   * @returns Promise resolving to an AgentGraphRunnerResult.
   */
  run(input: string): Promise<AgentGraphRunnerResult>;
}
