import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDGraphMetricSummary, LDGraphTracker } from './api/graph/LDGraphTracker';
import { LDJudgeResult } from './api/judge/types';
import { LDTokenUsage } from './api/metrics';
import { LDClientMin } from './LDClientMin';

export class LDGraphTrackerImpl implements LDGraphTracker {
  private _trackedMetrics: LDGraphMetricSummary = {};

  constructor(
    private _ldClient: LDClientMin,
    private _graphKey: string,
    private _variationKey: string,
    private _version: number,
    private _context: LDContext,
  ) {}

  getTrackData(): {
    variationKey: string;
    graphKey: string;
    version: number;
  } {
    return {
      variationKey: this._variationKey,
      graphKey: this._graphKey,
      version: this._version,
    };
  }

  trackInvocationSuccess(): void {
    if (this._trackedMetrics.success !== undefined) {
      return;
    }
    this._trackedMetrics.success = true;
    this._ldClient.track('$ld:ai:graph:invocation_success', this._context, this.getTrackData(), 1);
  }

  trackInvocationFailure(): void {
    if (this._trackedMetrics.success !== undefined) {
      return;
    }
    this._trackedMetrics.success = false;
    this._ldClient.track('$ld:ai:graph:invocation_failure', this._context, this.getTrackData(), 1);
  }

  trackLatency(durationMs: number): void {
    if (this._trackedMetrics.durationMs !== undefined) {
      return;
    }
    this._trackedMetrics.durationMs = durationMs;
    this._ldClient.track('$ld:ai:graph:latency', this._context, this.getTrackData(), durationMs);
  }

  trackTotalTokens(tokens: LDTokenUsage): void {
    if (this._trackedMetrics.tokens !== undefined) {
      return;
    }
    if (tokens.total <= 0) {
      return;
    }
    this._trackedMetrics.tokens = tokens;
    this._ldClient.track(
      '$ld:ai:graph:total_tokens',
      this._context,
      this.getTrackData(),
      tokens.total,
    );
  }

  trackPath(path: string[]): void {
    if (this._trackedMetrics.path !== undefined) {
      return;
    }
    this._trackedMetrics.path = path;
    this._ldClient.track('$ld:ai:graph:path', this._context, { ...this.getTrackData(), path }, 1);
  }

  trackJudgeResult(result: LDJudgeResult): void {
    if (!result.sampled) {
      return;
    }
    if (!result.success) {
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

  getSummary(): LDGraphMetricSummary {
    return { ...this._trackedMetrics };
  }
}
