import { LDMessage } from '../config/types';
import { AgentGraphRunnerResult } from '../graph/types';
import { RunnerResult } from '../model/types';

/**
 * Runner protocol for AI model providers.
 *
 * A single Runner interface covers completion, agent, and judge use cases.
 * For structured output (e.g., judge evaluation), pass an `outputType` schema
 * and access the parsed result via `RunnerResult.parsed`.
 */
export interface Runner {
  /**
   * Invoke the model with the given input.
   *
   * @param input The input to the model. For agents this is a string prompt;
   *   for model completions and judges this is an array of messages.
   * @param outputType Optional JSON schema for structured output. When provided,
   *   the model should return structured data accessible via `RunnerResult.parsed`.
   * @returns Promise resolving to a RunnerResult.
   */
  run(input: string | LDMessage[], outputType?: Record<string, unknown>): Promise<RunnerResult>;
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
