import { integrations, LDEvaluationDetail } from '@launchdarkly/js-server-sdk-common';
import { BaseTestHook } from '../shared/BaseTestHook.js';

export default class TestHook extends BaseTestHook implements integrations.Hook {
  protected async _safePost(body: unknown): Promise<void> {
    try {
      await fetch(this._endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // The test could move on before the post, so we are ignoring
      // failed posts.
    }
  }

  override getMetadata(): integrations.HookMetadata {
    return super.getMetadata();
  }

  beforeEvaluation(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ): integrations.EvaluationSeriesData {
    return this._beforeEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
    ) as integrations.EvaluationSeriesData;
  }

  afterEvaluation(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationSeriesData {
    return this._afterEvaluationImpl(
      hookContext as unknown as Record<string, unknown>,
      data,
      detail,
    ) as integrations.EvaluationSeriesData;
  }
}
