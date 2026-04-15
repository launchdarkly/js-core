import type { LDContext } from '@launchdarkly/js-server-sdk-common';

import type { LDGraphTracker } from './api/graph/LDGraphTracker';
import type { LDGraphMetricSummary, LDGraphTrackData } from './api/graph/types';
import type { LDJudgeResult } from './api/judge/types';
import type { LDTokenUsage } from './api/metrics';
import type { LDClientMin } from './LDClientMin';

/**
 * Concrete implementation of {@link LDGraphTracker}.
 *
 * Instantiate via {@link AgentGraphDefinition.createTracker} or reconstruct from
 * a resumption token via {@link LDGraphTrackerImpl.fromResumptionToken}.
 */
export class LDGraphTrackerImpl implements LDGraphTracker {
  private _summary: LDGraphMetricSummary = {};

  constructor(
    private readonly _ldClient: LDClientMin,
    private readonly _runId: string,
    private readonly _graphKey: string,
    private readonly _variationKey: string | undefined,
    private readonly _version: number,
    private readonly _context: LDContext,
  ) {}

  /**
   * Reconstructs an {@link LDGraphTrackerImpl} from a resumption token, preserving
   * the original `runId` so all events continue to be correlated under the same run.
   *
   * **Security note:** The token contains the flag variation key and version.
   * Do not pass the raw token to untrusted clients.
   *
   * @param token URL-safe Base64-encoded token produced by {@link LDGraphTrackerImpl.resumptionToken}.
   * @param ldClient LaunchDarkly client instance.
   * @param context LDContext for the new tracker.
   */
  static fromResumptionToken(
    token: string,
    ldClient: LDClientMin,
    context: LDContext,
  ): LDGraphTrackerImpl {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const data = JSON.parse(json) as LDGraphTrackData;
    return new LDGraphTrackerImpl(
      ldClient,
      data.runId,
      data.graphKey,
      data.variationKey,
      data.version,
      context,
    );
  }

  getTrackData(): LDGraphTrackData {
    const data: LDGraphTrackData = {
      runId: this._runId,
      graphKey: this._graphKey,
      version: this._version,
    };
    if (this._variationKey !== undefined) {
      data.variationKey = this._variationKey;
    }
    return data;
  }

  getSummary(): LDGraphMetricSummary {
    return { ...this._summary };
  }

  get resumptionToken(): string {
    // Keys must appear in exact spec-defined order:
    // runId, graphKey, variationKey (omitted if absent), version
    const parts: string[] = [
      `"runId":${JSON.stringify(this._runId)}`,
      `"graphKey":${JSON.stringify(this._graphKey)}`,
    ];
    if (this._variationKey !== undefined) {
      parts.push(`"variationKey":${JSON.stringify(this._variationKey)}`);
    }
    parts.push(`"version":${this._version}`);
    const json = `{${parts.join(',')}}`;
    return Buffer.from(json).toString('base64url');
  }

  trackInvocationSuccess(): void {
    if (this._summary.success !== undefined) {
      this._ldClient.logger?.warn(
        'LDGraphTracker: trackInvocationSuccess already called for this run — dropping duplicate call.',
      );
      return;
    }
    this._summary.success = true;
    this._ldClient.track('$ld:ai:graph:invocation_success', this._context, this.getTrackData(), 1);
  }

  trackInvocationFailure(): void {
    if (this._summary.success !== undefined) {
      this._ldClient.logger?.warn(
        'LDGraphTracker: trackInvocationFailure already called for this run — dropping duplicate call.',
      );
      return;
    }
    this._summary.success = false;
    this._ldClient.track('$ld:ai:graph:invocation_failure', this._context, this.getTrackData(), 1);
  }

  trackLatency(durationMs: number): void {
    if (this._summary.durationMs !== undefined) {
      this._ldClient.logger?.warn(
        'LDGraphTracker: trackLatency already called for this run — dropping duplicate call.',
      );
      return;
    }
    this._summary.durationMs = durationMs;
    this._ldClient.track('$ld:ai:graph:latency', this._context, this.getTrackData(), durationMs);
  }

  trackTotalTokens(tokens: LDTokenUsage): void {
    if (this._summary.tokens !== undefined) {
      this._ldClient.logger?.warn(
        'LDGraphTracker: trackTotalTokens already called for this run — dropping duplicate call.',
      );
      return;
    }
    this._summary.tokens = { ...tokens };
    this._ldClient.track(
      '$ld:ai:graph:total_tokens',
      this._context,
      this.getTrackData(),
      tokens.total,
    );
  }

  trackPath(path: string[]): void {
    if (this._summary.path !== undefined) {
      this._ldClient.logger?.warn(
        'LDGraphTracker: trackPath already called for this run — dropping duplicate call.',
      );
      return;
    }
    this._summary.path = [...path];
    this._ldClient.track('$ld:ai:graph:path', this._context, { ...this.getTrackData(), path }, 1);
  }

  trackJudgeResult(result: LDJudgeResult): void {
    if (!result.sampled || !result.success) {
      return;
    }
    if (result.metricKey !== undefined && result.score !== undefined) {
      const trackData = result.judgeConfigKey
        ? { ...this.getTrackData(), judgeConfigKey: result.judgeConfigKey }
        : this.getTrackData();

      this._ldClient.track(result.metricKey, this._context, trackData, result.score);
    }
  }

  trackRedirect(sourceKey: string, redirectedTarget: string): void {
    this._ldClient.track(
      '$ld:ai:graph:redirect',
      this._context,
      { ...this.getTrackData(), sourceKey, redirectedTarget },
      1,
    );
  }

  trackHandoffSuccess(sourceKey: string, targetKey: string): void {
    this._ldClient.track(
      '$ld:ai:graph:handoff_success',
      this._context,
      { ...this.getTrackData(), sourceKey, targetKey },
      1,
    );
  }

  trackHandoffFailure(sourceKey: string, targetKey: string): void {
    this._ldClient.track(
      '$ld:ai:graph:handoff_failure',
      this._context,
      { ...this.getTrackData(), sourceKey, targetKey },
      1,
    );
  }
}
