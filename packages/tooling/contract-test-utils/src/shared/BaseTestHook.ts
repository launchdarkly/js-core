import { HookData, HookErrors } from '../types/CommandParams.js';

import { HookPostQueue } from './HookPostQueue.js';

export abstract class BaseTestHook {
  protected readonly hookName: string;
  protected readonly endpoint: string;
  protected readonly hookData?: HookData;
  protected readonly hookErrors?: HookErrors;
  private readonly _postQueue: HookPostQueue;

  constructor(
    name: string,
    endpoint: string,
    data?: HookData,
    errors?: HookErrors,
    postQueue?: HookPostQueue,
  ) {
    this.hookName = name;
    this.endpoint = endpoint;
    this.hookData = data;
    this.hookErrors = errors;
    this._postQueue = postQueue ?? new HookPostQueue();
  }

  protected abstract safePost(body: unknown): Promise<void>;

  protected enqueuePost(body: unknown): void {
    this._postQueue.enqueue(() => this.safePost(body));
  }

  getMetadata() {
    return { name: this.hookName };
  }

  protected beforeEvaluationImpl(
    hookContext: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.hookErrors?.beforeEvaluation) {
      throw new Error(this.hookErrors.beforeEvaluation);
    }
    this.enqueuePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'beforeEvaluation',
    });
    return { ...data, ...(this.hookData?.beforeEvaluation ?? {}) };
  }

  protected afterEvaluationImpl(
    hookContext: Record<string, unknown>,
    data: Record<string, unknown>,
    detail: unknown,
  ): Record<string, unknown> {
    if (this.hookErrors?.afterEvaluation) {
      throw new Error(this.hookErrors.afterEvaluation);
    }
    this.enqueuePost({
      evaluationSeriesContext: hookContext,
      evaluationSeriesData: data,
      stage: 'afterEvaluation',
      evaluationDetail: detail,
    });
    return { ...data, ...(this.hookData?.afterEvaluation ?? {}) };
  }
}
