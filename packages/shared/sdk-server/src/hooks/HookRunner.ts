import { LDContext, LDEvaluationDetail, LDLogger } from '@launchdarkly/js-sdk-common';

import { EvaluationSeriesContext, EvaluationSeriesData, Hook } from '../integrations';

const BEFORE_EVALUATION_STAGE_NAME = 'beforeEvaluation';
const AFTER_EVALUATION_STAGE_NAME = 'afterEvaluation';
const UNKNOWN_HOOK_NAME = 'unknown hook';

export default class HookRunner {
  private readonly hooks: Hook[] = [];

  constructor(
    private readonly logger: LDLogger | undefined,
    hooks: Hook[],
  ) {
    this.hooks.push(...hooks);
  }

  public async withHooks(
    key: string,
    context: LDContext,
    defaultValue: unknown,
    methodName: string,
    method: () => Promise<LDEvaluationDetail>,
  ): Promise<LDEvaluationDetail> {
    if (this.hooks.length === 0) {
      return method();
    }
    const { hooks, hookContext }: { hooks: Hook[]; hookContext: EvaluationSeriesContext } =
      this.prepareHooks(key, context, defaultValue, methodName);
    const hookData = this.executeBeforeEvaluation(hooks, hookContext);
    const result = await method();
    this.executeAfterEvaluation(hooks, hookContext, hookData, result);
    return result;
  }

  public async withHooksCustom(
    key: string,
    context: LDContext,
    defaultValue: unknown,
    methodName: string,
    method: () => Promise<{ detail: LDEvaluationDetail; [index: string]: any }>,
  ): Promise<{ detail: LDEvaluationDetail; [index: string]: any }> {
    if (this.hooks.length === 0) {
      return method();
    }
    const { hooks, hookContext }: { hooks: Hook[]; hookContext: EvaluationSeriesContext } =
      this.prepareHooks(key, context, defaultValue, methodName);
    const hookData = this.executeBeforeEvaluation(hooks, hookContext);
    const result = await method();
    this.executeAfterEvaluation(hooks, hookContext, hookData, result.detail);
    return result;
  }

  private tryExecuteStage(
    method: string,
    hookName: string,
    stage: () => EvaluationSeriesData,
  ): EvaluationSeriesData {
    try {
      return stage();
    } catch (err) {
      this.logger?.error(
        `An error was encountered in "${method}" of the "${hookName}" hook: ${err}`,
      );
      return {};
    }
  }

  private hookName(hook?: Hook): string {
    try {
      return hook?.getMetadata().name ?? UNKNOWN_HOOK_NAME;
    } catch {
      this.logger?.error(`Exception thrown getting metadata for hook. Unable to get hook name.`);
      return UNKNOWN_HOOK_NAME;
    }
  }

  private executeAfterEvaluation(
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
      this.tryExecuteStage(
        AFTER_EVALUATION_STAGE_NAME,
        this.hookName(hook),
        () => hook?.afterEvaluation?.(hookContext, data, result) ?? {},
      );
    }
  }

  private executeBeforeEvaluation(
    hooks: Hook[],
    hookContext: EvaluationSeriesContext,
  ): EvaluationSeriesData[] {
    return hooks.map((hook) =>
      this.tryExecuteStage(
        BEFORE_EVALUATION_STAGE_NAME,
        this.hookName(hook),
        () => hook?.beforeEvaluation?.(hookContext, {}) ?? {},
      ),
    );
  }

  private prepareHooks(
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
    const hooks: Hook[] = [...this.hooks];
    const hookContext: EvaluationSeriesContext = {
      flagKey: key,
      context,
      defaultValue,
      method: methodName,
    };
    return { hooks, hookContext };
  }

  addHook(hook: Hook): void {
    this.hooks.push(hook);
  }
}
