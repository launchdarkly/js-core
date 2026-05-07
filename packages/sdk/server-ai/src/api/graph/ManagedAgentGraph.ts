import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIMetrics } from '../metrics';
import { LDAIMetricSummary } from '../model/types';
import { LDJudgeResult } from '../judge/types';
import { AgentGraphDefinition } from './AgentGraphDefinition';
import { LDGraphTracker } from './LDGraphTracker';
import { AgentGraphRunnerResult, LDAIGraphMetricSummary, ManagedGraphResult } from './types';

/**
 * ManagedAgentGraph wraps an AgentGraphDefinition and provides a managed run()
 * method that returns ManagedGraphResult with async judge evaluations.
 *
 * The runner function is responsible for executing the graph and returning
 * an AgentGraphRunnerResult. ManagedAgentGraph builds the managed result from
 * the runner result, including LDAIGraphMetricSummary with the graphTracker's
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
   * @returns ManagedGraphResult with LDAIGraphMetricSummary and evaluations promise.
   */
  async run(
    runner: (
      graphDefinition: AgentGraphDefinition,
      graphTracker: LDGraphTracker,
    ) => Promise<AgentGraphRunnerResult>,
  ): Promise<ManagedGraphResult> {
    const graphTracker = this._graphDefinition.createTracker();

    const runnerResult = await runner(this._graphDefinition, graphTracker);

    const metrics: LDAIGraphMetricSummary = {
      success: runnerResult.metrics.success,
      path: runnerResult.metrics.path,
      durationMs: runnerResult.metrics.durationMs,
      tokens: runnerResult.metrics.tokens,
      nodeMetrics: this._trackNodeMetrics(runnerResult.metrics.nodeMetrics),
      resumptionToken: graphTracker.resumptionToken,
    };

    const evaluations: Promise<LDJudgeResult[]> = Promise.resolve([]);

    return {
      content: runnerResult.content,
      metrics,
      raw: runnerResult.raw,
      evaluations,
    };
  }

  /**
   * Converts per-node LDAIMetrics from the runner into LDAIMetricSummary by
   * creating a per-node tracker, firing tracking events, and calling getSummary().
   */
  private _trackNodeMetrics(
    nodeMetrics: Record<string, LDAIMetrics>,
  ): Record<string, LDAIMetricSummary> {
    const summaries: Record<string, LDAIMetricSummary> = {};

    for (const [nodeKey, metrics] of Object.entries(nodeMetrics)) {
      const node = this._graphDefinition.getNode(nodeKey);
      if (!node) {
        this._logger?.warn(`ManagedAgentGraph: no node found for key "${nodeKey}", skipping metrics`);
        continue;
      }

      const tracker = node.getConfig().createTracker!();
      if (metrics.tokens) {
        tracker.trackTokens(metrics.tokens);
      }
      if (metrics.durationMs !== undefined) {
        tracker.trackDuration(metrics.durationMs);
      }
      if (metrics.toolCalls?.length) {
        tracker.trackToolCalls(metrics.toolCalls);
      }
      if (metrics.success) {
        tracker.trackSuccess();
      } else {
        tracker.trackError();
      }

      summaries[nodeKey] = tracker.getSummary();
    }

    return summaries;
  }

  /**
   * Returns the underlying AgentGraphDefinition.
   */
  getGraphDefinition(): AgentGraphDefinition {
    return this._graphDefinition;
  }
}
