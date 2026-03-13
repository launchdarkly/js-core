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
  protected async _safePost(body: unknown): Promise<void> {
    try {
      await fetch(this._endpoint, {
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
    return this._beforeEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
    ) as EvaluationSeriesData;
  }

  afterEvaluation(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): EvaluationSeriesData {
    return this._afterEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
      detail,
    ) as EvaluationSeriesData;
  }

  afterTrack(hookContext: TrackSeriesContext): void {
    if (this._errors?.afterTrack) {
      throw new Error(this._errors.afterTrack);
    }
    this._safePost({
      trackSeriesContext: hookContext,
      stage: 'afterTrack',
    });
  }
}
