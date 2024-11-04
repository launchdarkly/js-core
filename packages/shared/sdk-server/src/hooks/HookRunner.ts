import { LDContext, LDEvaluationDetail, LDLogger } from '@launchdarkly/js-sdk-common';

import { EvaluationSeriesContext, EvaluationSeriesData, Hook } from '../integrations';

const BEFORE_EVALUATION_STAGE_NAME = 'beforeEvaluation';
const AFTER_EVALUATION_STAGE_NAME = 'afterEvaluation';
const UNKNOWN_HOOK_NAME = 'unknown hook';

export default class HookRunner {
  private readonly _hooks: Hook[] = [];

  constructor(
    private readonly _logger: LDLogger | undefined,
    hooks: Hook[],
  ) {
    this._hooks.push(...hooks);
  }

  public async withEvaluationSeries(
    key: string,
    context: LDContext,
    defaultValue: unknown,
    methodName: string,
    method: () => Promise<LDEvaluationDetail>,
  ): Promise<LDEvaluationDetail> {
    // This early return is here to avoid the extra async/await associated with
    // using withHooksDataWithDetail.
    if (this._hooks.length === 0) {
      return method();
    }

    return this.withEvaluationSeriesExtraDetail(
      key,
      context,
      defaultValue,
      methodName,
      async () => {
        const detail = await method();
        return { detail };
      },
    ).then(({ detail }) => detail);
  }

  /**
   * This function allows extra information to be returned with the detail for situations like
   * migrations where a tracker is returned with the detail.
   */
  public async withEvaluationSeriesExtraDetail(
    key: string,
    context: LDContext,
    defaultValue: unknown,
    methodName: string,
    method: () => Promise<{ detail: LDEvaluationDetail; [index: string]: any }>,
  ): Promise<{ detail: LDEvaluationDetail; [index: string]: any }> {
    if (this._hooks.length === 0) {
      return method();
    }
    const { hooks, hookContext }: { hooks: Hook[]; hookContext: EvaluationSeriesContext } =
      this._prepareHooks(key, context, defaultValue, methodName);
    const hookData = this._executeBeforeEvaluation(hooks, hookContext);
    const result = await method();
    this._executeAfterEvaluation(hooks, hookContext, hookData, result.detail);
    return result;
  }

  private _tryExecuteStage(
    method: string,
    hookName: string,
    stage: () => EvaluationSeriesData,
  ): EvaluationSeriesData {
    try {
      return stage();
    } catch (err) {
      this._logger?.error(
        `An error was encountered in "${method}" of the "${hookName}" hook: ${err}`,
      );
      return {};
    }
  }

  private _hookName(hook?: Hook): string {
    try {
      return hook?.getMetadata().name ?? UNKNOWN_HOOK_NAME;
    } catch {
      this._logger?.error(`Exception thrown getting metadata for hook. Unable to get hook name.`);
      return UNKNOWN_HOOK_NAME;
    }
  }

  private _executeAfterEvaluation(
    hooks: Hook[],
    hookContext: EvaluationSeriesContext,
    updatedData: (EvaluationSeriesData | undefined)[],
    result: LDEvaluationDetail,
  ) {
    // This iterates in reverse, versus reversing a shallow copy of the hooks,
    // for efficiency.
    for (let hookIndex = hooks.length - 1; hookIndex >= 0; hookIndex -= 1) {
      const hook = hooks[hookIndex];
      const data = updatedData[hookIndex] ?? {};
      this._tryExecuteStage(
        AFTER_EVALUATION_STAGE_NAME,
        this._hookName(hook),
        () => hook?.afterEvaluation?.(hookContext, data, result) ?? {},
      );
    }
  }

  private _executeBeforeEvaluation(
    hooks: Hook[],
    hookContext: EvaluationSeriesContext,
  ): EvaluationSeriesData[] {
    return hooks.map((hook) =>
      this._tryExecuteStage(
        BEFORE_EVALUATION_STAGE_NAME,
        this._hookName(hook),
        () => hook?.beforeEvaluation?.(hookContext, {}) ?? {},
      ),
    );
  }

  private _prepareHooks(
    key: string,
    context: LDContext,
    defaultValue: unknown,
    methodName: string,
  ): {
    hooks: Hook[];
    hookContext: EvaluationSeriesContext;
  } {
    // Copy the hooks to use a consistent set during evaluation. Hooks could be added and we want
    // to ensure all correct stages for any give hook execute. Not for instance the afterEvaluation
    // stage without beforeEvaluation having been called on that hook.
    const hooks: Hook[] = [...this._hooks];
    const hookContext: EvaluationSeriesContext = {
      flagKey: key,
      context,
      defaultValue,
      method: methodName,
    };
    return { hooks, hookContext };
  }

  addHook(hook: Hook): void {
    this._hooks.push(hook);
  }
}
