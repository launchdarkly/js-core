import { LDEvaluationDetail } from '@launchdarkly/js-sdk-common';

import {
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  HookMetadata,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
  TrackSeriesContext,
} from '../../src/api/integrations/Hooks';

export type EvalCapture = {
  method: string;
  hookContext: EvaluationSeriesContext;
  hookData: EvaluationSeriesData;
  detail?: LDEvaluationDetail;
};

export type IdentifyCapture = {
  method: string;
  hookContext: IdentifySeriesContext;
  hookData: IdentifySeriesData;
  result?: IdentifySeriesResult;
};

export type TrackCapture = {
  method: string;
  hookContext: TrackSeriesContext;
};

export class TestHook implements Hook {
  captureBefore: EvalCapture[] = [];
  captureAfter: EvalCapture[] = [];
  captureIdentifyBefore: IdentifyCapture[] = [];
  captureIdentifyAfter: IdentifyCapture[] = [];
  captureTrack: TrackCapture[] = [];

  getMetadataImpl: () => HookMetadata = () => ({ name: 'LaunchDarkly Test Hook' });

  getMetadata(): HookMetadata {
    return this.getMetadataImpl();
  }

  beforeEvalImpl: (
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
  ) => EvaluationSeriesData = (_hookContext, data) => data;

  afterEvalImpl: (
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ) => EvaluationSeriesData = (_hookContext, data, _detail) => data;

  beforeEvaluation?(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
  ): EvaluationSeriesData {
    this.captureBefore.push({ method: 'beforeEvaluation', hookContext, hookData: data });
    return this.beforeEvalImpl(hookContext, data);
  }

  afterEvaluation?(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): EvaluationSeriesData {
    this.captureAfter.push({ method: 'afterEvaluation', hookContext, hookData: data, detail });
    return this.afterEvalImpl(hookContext, data, detail);
  }

  beforeIdentifyImpl: (
    hookContext: IdentifySeriesContext,
    data: IdentifySeriesData,
  ) => IdentifySeriesData = (_hookContext, data) => data;

  afterIdentifyImpl: (
    hookContext: IdentifySeriesContext,
    data: IdentifySeriesData,
    result: IdentifySeriesResult,
  ) => IdentifySeriesData = (_hookContext, data, _result) => data;

  afterTrackImpl: (hookContext: TrackSeriesContext) => void = () => {};

  beforeIdentify?(
    hookContext: IdentifySeriesContext,
    data: IdentifySeriesData,
  ): IdentifySeriesData {
    this.captureIdentifyBefore.push({ method: 'beforeIdentify', hookContext, hookData: data });
    return this.beforeIdentifyImpl(hookContext, data);
  }

  afterIdentify?(
    hookContext: IdentifySeriesContext,
    data: IdentifySeriesData,
    result: IdentifySeriesResult,
  ): IdentifySeriesData {
    this.captureIdentifyAfter.push({
      method: 'afterIdentify',
      hookContext,
      hookData: data,
      result,
    });
    return this.afterIdentifyImpl(hookContext, data, result);
  }

  afterTrack?(hookContext: TrackSeriesContext): void {
    this.captureTrack.push({ method: 'afterTrack', hookContext });
    this.afterTrackImpl(hookContext);
  }
}
