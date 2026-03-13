import { HookData, HookErrors } from '../types/CommandParams.js';

export abstract class BaseTestHook {
  protected readonly _name: string;
  protected readonly _endpoint: string;
  protected readonly _data?: HookData;
  protected readonly _errors?: HookErrors;

  constructor(name: string, endpoint: string, data?: HookData, errors?: HookErrors) {
    this._name = name;
    this._endpoint = endpoint;
    this._data = data;
    this._errors = errors;
  }

  protected abstract _safePost(body: unknown): Promise<void>;

  getMetadata() {
    return { name: this._name };
  }

  protected _beforeEvaluationImpl(
    hookContext: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this._errors?.beforeEvaluation) {
      throw new Error(this._errors.beforeEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'beforeEvaluation',
    });
    return { ...data, ...(this._data?.beforeEvaluation ?? {}) };
  }

  protected _afterEvaluationImpl(
    hookContext: Record<string, unknown>,
    data: Record<string, unknown>,
    detail: unknown,
  ): Record<string, unknown> {
    if (this._errors?.afterEvaluation) {
      throw new Error(this._errors.afterEvaluation);
    }
    this._safePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'afterEvaluation',
      evaluationDetail: detail,
    });
    return { ...data, ...(this._data?.afterEvaluation ?? {}) };
  }
}
