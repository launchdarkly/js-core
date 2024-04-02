import { integrations, LDEvaluationDetail } from '../../src';

export type EvalCapture = {
  method: string;
  hookContext: integrations.EvaluationSeriesContext;
  hookData: integrations.EvaluationSeriesData;
  detail?: LDEvaluationDetail;
};

export class TestHook implements integrations.Hook {
  captureBefore: EvalCapture[] = [];
  captureAfter: EvalCapture[] = [];

  getMetadataImpl: () => integrations.HookMetadata = () => ({ name: 'LaunchDarkly Test Hook' });

  getMetadata(): integrations.HookMetadata {
    return this.getMetadataImpl();
  }

  verifyBefore(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ) {
    expect(this.captureBefore).toHaveLength(1);
    expect(this.captureBefore[0].hookContext).toEqual(hookContext);
    expect(this.captureBefore[0].hookData).toEqual(data);
  }

  verifyAfter(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ) {
    expect(this.captureAfter).toHaveLength(1);
    expect(this.captureAfter[0].hookContext).toEqual(hookContext);
    expect(this.captureAfter[0].hookData).toEqual(data);
    expect(this.captureAfter[0].detail).toEqual(detail);
  }

  beforeEvalImpl: (
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ) => integrations.EvaluationSeriesData = (_hookContext, data) => data;

  afterEvalImpl: (
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ) => integrations.EvaluationSeriesData = (_hookContext, data, _detail) => data;

  beforeEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ): integrations.EvaluationSeriesData {
    this.captureBefore.push({ method: 'beforeEvaluation', hookContext, hookData: data });
    return this.beforeEvalImpl(hookContext, data);
  }

  afterEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationSeriesData {
    this.captureAfter.push({ method: 'afterEvaluation', hookContext, hookData: data, detail });
    return this.afterEvalImpl(hookContext, data, detail);
  }
}
