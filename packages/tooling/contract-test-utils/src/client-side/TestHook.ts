import {
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  HookMetadata,
  LDEvaluationDetail,
  TrackSeriesContext,
} from '@launchdarkly/js-client-sdk-common';

import { BaseTestHook } from '../shared/BaseTestHook.js';

export default class TestHook extends BaseTestHook implements Hook {
  protected async safePost(body: unknown): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch {
      // The test could move on before the post, so we are ignoring
      // failed posts.
    }
  }

  override getMetadata(): HookMetadata {
    return super.getMetadata();
  }

  beforeEvaluation(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
  ): EvaluationSeriesData {
    return this.beforeEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
    ) as EvaluationSeriesData;
  }

  afterEvaluation(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): EvaluationSeriesData {
    return this.afterEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
      detail,
    ) as EvaluationSeriesData;
  }

  afterTrack(hookContext: TrackSeriesContext): void {
    if (this.hookErrors?.afterTrack) {
      throw new Error(this.hookErrors.afterTrack);
    }
    this.safePost({
      trackSeriesContext: hookContext,
      stage: 'afterTrack',
    });
  }
}
