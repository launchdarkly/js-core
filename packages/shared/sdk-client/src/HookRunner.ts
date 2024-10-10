import { LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import {
  EvaluationSeriesContext,
  EvaluationSeriesData,
  Hook,
  IdentifySeriesContext,
  IdentifySeriesData,
  IdentifySeriesResult,
} from './api/integrations/Hooks';
import { LDEvaluationDetail } from './api/LDEvaluationDetail';

const UNKNOWN_HOOK_NAME = 'unknown hook';
const BEFORE_EVALUATION_STAGE_NAME = 'beforeEvaluation';
const AFTER_EVALUATION_STAGE_NAME = 'afterEvaluation';

function tryExecuteStage<TData>(
  logger: LDLogger,
  method: string,
  hookName: string,
  stage: () => TData,
  def: TData,
): TData {
  try {
    return stage();
  } catch (err) {
    logger?.error(`An error was encountered in "${method}" of the "${hookName}" hook: ${err}`);
    return def;
  }
}

function getHookName(logger: LDLogger, hook: Hook): string {
  try {
    return hook.getMetadata().name || UNKNOWN_HOOK_NAME;
  } catch {
    logger.error(`Exception thrown getting metadata for hook. Unable to get hook name.`);
    return UNKNOWN_HOOK_NAME;
  }
}

function executeBeforeEvaluation(
  logger: LDLogger,
  hooks: Hook[],
  hookContext: EvaluationSeriesContext,
): EvaluationSeriesData[] {
  return hooks.map((hook) =>
    tryExecuteStage(
      logger,
      BEFORE_EVALUATION_STAGE_NAME,
      getHookName(logger, hook),
      () => hook?.beforeEvaluation?.(hookContext, {}) ?? {},
      {},
    ),
  );
}

function executeAfterEvaluation(
  logger: LDLogger,
  hooks: Hook[],
  hookContext: EvaluationSeriesContext,
  updatedData: EvaluationSeriesData[],
  result: LDEvaluationDetail,
) {
  // This iterates in reverse, versus reversing a shallow copy of the hooks,
  // for efficiency.
  for (let hookIndex = hooks.length - 1; hookIndex >= 0; hookIndex -= 1) {
    const hook = hooks[hookIndex];
    const data = updatedData[hookIndex];
    tryExecuteStage(
      logger,
      AFTER_EVALUATION_STAGE_NAME,
      getHookName(logger, hook),
      () => hook?.afterEvaluation?.(hookContext, data, result) ?? {},
      {},
    );
  }
}

function executeBeforeIdentify(
  logger: LDLogger,
  hooks: Hook[],
  hookContext: IdentifySeriesContext,
): IdentifySeriesData[] {
  return hooks.map((hook) =>
    tryExecuteStage(
      logger,
      BEFORE_EVALUATION_STAGE_NAME,
      getHookName(logger, hook),
      () => hook?.beforeIdentify?.(hookContext, {}) ?? {},
      {},
    ),
  );
}

function executeAfterIdentify(
  logger: LDLogger,
  hooks: Hook[],
  hookContext: IdentifySeriesContext,
  updatedData: IdentifySeriesData[],
  result: IdentifySeriesResult,
) {
  // This iterates in reverse, versus reversing a shallow copy of the hooks,
  // for efficiency.
  for (let hookIndex = hooks.length - 1; hookIndex >= 0; hookIndex -= 1) {
    const hook = hooks[hookIndex];
    const data = updatedData[hookIndex];
    tryExecuteStage(
      logger,
      AFTER_EVALUATION_STAGE_NAME,
      getHookName(logger, hook),
      () => hook?.afterIdentify?.(hookContext, data, result) ?? {},
      {},
    );
  }
}

export default class HookRunner {
  private readonly _hooks: Hook[] = [];

  constructor(
    private readonly _logger: LDLogger,
    initialHooks: Hook[],
  ) {
    this._hooks.push(...initialHooks);
  }

  withEvaluation(
    key: string,
    context: LDContext | undefined,
    defaultValue: unknown,
    method: () => LDEvaluationDetail,
  ): LDEvaluationDetail {
    if (this._hooks.length === 0) {
      return method();
    }
    const hooks: Hook[] = [...this._hooks];
    const hookContext: EvaluationSeriesContext = {
      flagKey: key,
      context,
      defaultValue,
    };

    const hookData = executeBeforeEvaluation(this._logger, hooks, hookContext);
    const result = method();
    executeAfterEvaluation(this._logger, hooks, hookContext, hookData, result);
    return result;
  }

  identify(
    context: LDContext,
    timeout: number | undefined,
  ): (result: IdentifySeriesResult) => void {
    const hooks: Hook[] = [...this._hooks];
    const hookContext: IdentifySeriesContext = {
      context,
      timeout,
    };
    const hookData = executeBeforeIdentify(this._logger, hooks, hookContext);
    return (result) => {
      executeAfterIdentify(this._logger, hooks, hookContext, hookData, result);
    };
  }

  addHook(hook: Hook): void {
    this._hooks.push(hook);
  }
}
