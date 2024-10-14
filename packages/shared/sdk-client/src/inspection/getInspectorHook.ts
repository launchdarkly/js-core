import { EvaluationSeriesContext, EvaluationSeriesData, Hook, LDEvaluationDetail } from '../api';
import InspectorManager from './InspectorManager';

export function getInspectorHook(inspectorManager: InspectorManager): Hook {
  return {
    getMetadata() {
      return {
        name: 'LaunchDarkly-Inspector-Adapter',
      };
    },
    afterEvaluation: (
      hookContext: EvaluationSeriesContext,
      data: EvaluationSeriesData,
      detail: LDEvaluationDetail,
    ) => {
      inspectorManager.onFlagUsed(hookContext.flagKey, detail, hookContext.context);
      return data;
    },
    afterIdentify(hookContext, data, _result) {
      inspectorManager.onIdentityChanged(hookContext.context);
      return data;
    },
  };
}
