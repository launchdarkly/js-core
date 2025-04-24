import {
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  HookMetadata,
  LDEvaluationDetail,
  TrackSeriesContext,
} from '@launchdarkly/js-client-sdk';

export interface HookData {
  beforeEvaluation?: Record<string, unknown>;
  afterEvaluation?: Record<string, unknown>;
}

export interface HookErrors {
  beforeEvaluation?: string;
  afterEvaluation?: string;
  afterTrack?: string;
}

export default class TestHook implements Hook {
  private _name: string;
  private _endpoint: string;
  private _data?: HookData;
  private _errors?: HookErrors;

  constructor(name: string, endpoint: string, data?: HookData, errors?: HookErrors) {
    this._name = name;
    this._endpoint = endpoint;
    this._data = data;
    this._errors = errors;
  }

  private async _safePost(body: unknown): Promise<void> {
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

  getMetadata(): HookMetadata {
    return {
      name: this._name,
    };
  }

  beforeEvaluation(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
  ): EvaluationSeriesData {
    if (this._errors?.beforeEvaluation) {
      throw new Error(this._errors.beforeEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'beforeEvaluation',
    });
    return { ...data, ...(this._data?.beforeEvaluation || {}) };
  }

  afterEvaluation(
    hookContext: EvaluationSeriesContext,
    data: EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): EvaluationSeriesData {
    if (this._errors?.afterEvaluation) {
      throw new Error(this._errors.afterEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'afterEvaluation',
      evaluationDetail: detail,
    });

    return { ...data, ...(this._data?.afterEvaluation || {}) };
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
