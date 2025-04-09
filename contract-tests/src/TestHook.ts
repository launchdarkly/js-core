import got from 'got';

import { integrations, LDEvaluationDetail } from '@launchdarkly/node-server-sdk';

export interface HookData {
  beforeEvaluation?: Record<string, unknown>;
  afterEvaluation?: Record<string, unknown>;
}

export interface HookErrors {
  beforeEvaluation?: string;
  afterEvaluation?: string;
}

export default class TestHook implements integrations.Hook {
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
      await got.post(this._endpoint, { json: body });
    } catch {
      // The test could move on before the post, so we are ignoring
      // failed posts.
    }
  }

  getMetadata(): integrations.HookMetadata {
    return {
      name: this._name,
    };
  }

  beforeEvaluation(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ): integrations.EvaluationSeriesData {
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
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationSeriesData {
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
}
