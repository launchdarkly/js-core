import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDJudgeResult } from '../judge/types';
import { AgentGraphDefinition } from './AgentGraphDefinition';
import { LDGraphTracker } from './LDGraphTracker';
import { AgentGraphRunnerResult, GraphMetricSummary, ManagedGraphResult } from './types';

/**
 * ManagedAgentGraph wraps an AgentGraphDefinition and provides a managed run()
 * method that returns ManagedGraphResult with async judge evaluations.
 *
 * The runner function is responsible for executing the graph and returning
 * an AgentGraphRunnerResult. ManagedAgentGraph builds the managed result from
 * the runner result, including GraphMetricSummary with the graphTracker's
 * resumptionToken.
 */
export class ManagedAgentGraph {
  constructor(
    private readonly _graphDefinition: AgentGraphDefinition,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * Runs the agent graph using the provided runner function and returns a ManagedGraphResult.
   *
   * The runner function receives the graph tracker and AgentGraphDefinition,
   * executes the graph, and returns an AgentGraphRunnerResult.
   *
   * run() returns before ManagedGraphResult.evaluations resolves.
   *
   * @param runner Async function that executes the graph and returns AgentGraphRunnerResult.
   * @returns ManagedGraphResult with GraphMetricSummary and evaluations promise.
   */
  async run(
    runner: (
      graphDefinition: AgentGraphDefinition,
      graphTracker: LDGraphTracker,
    ) => Promise<AgentGraphRunnerResult>,
  ): Promise<ManagedGraphResult> {
    const graphTracker = this._graphDefinition.createTracker();

    const runnerResult = await runner(this._graphDefinition, graphTracker);

    const metrics: GraphMetricSummary = {
      success: runnerResult.metrics.success,
      path: runnerResult.metrics.path,
      durationMs: runnerResult.metrics.durationMs,
      usage: runnerResult.metrics.usage,
      nodeMetrics: runnerResult.metrics.nodeMetrics,
      resumptionToken: graphTracker.resumptionToken,
    };

    // No graph-level evaluator by default
    const evaluations: Promise<LDJudgeResult[]> = Promise.resolve([]);

    return {
      content: runnerResult.content,
      metrics,
      raw: runnerResult.raw,
      evaluations,
    };
  }

  /**
   * Returns the underlying AgentGraphDefinition.
   */
  getGraphDefinition(): AgentGraphDefinition {
    return this._graphDefinition;
  }
}
