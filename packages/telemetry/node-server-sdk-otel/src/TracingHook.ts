// eslint-disable-next-line max-classes-per-file
import { context, Span, trace } from '@opentelemetry/api';

import { Context, integrations, LDEvaluationDetail } from '@launchdarkly/node-server-sdk';

const FEATURE_FLAG_SCOPE = 'feature_flag';
const FEATURE_FLAG_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.key`;
const FEATURE_FLAG_PROVIDER_ATTR = `${FEATURE_FLAG_SCOPE}.provider_name`;
const FEATURE_FLAG_CONTEXT_KEY = `${FEATURE_FLAG_SCOPE}.context.key`;

/**
 * Options which allow configuring the tracing hook.
 */
export interface TracingHookOptions {
  /**
   * If set to true, then the tracing hook will add spans for each variation
   * method call.
   *
   * The default value is false.
   */
  spans: boolean;
}

type SpanTraceData = {
  span?: Span;
};

const defaultOptions: TracingHookOptions = {
  spans: false,
};

export default class TracingHook implements integrations.Hook {
  private readonly options: TracingHookOptions;
  private readonly tracer = trace.getTracer('launchdarkly-client');

  constructor(options?: TracingHookOptions) {
    // TODO: Add option verification.
    this.options = { ...defaultOptions, ...(options ?? {}) };
  }
  getMetadata(): integrations.HookMetadata {
    return {
      name: 'LaunchDarkly Tracing Hook',
    };
  }

  beforeEvaluation?(
    hookContext: integrations.EvaluationHookContext,
    data: integrations.EvaluationHookData,
  ): integrations.EvaluationHookData {
    if (this.options.spans) {
      const { canonicalKey } = Context.fromLDContext(hookContext.context);

      const span = this.tracer.startSpan(hookContext.method, undefined, context.active());
      span.setAttribute('feature_flag.context.key', canonicalKey);
      span.setAttribute('feature_flag.key', hookContext.key);

      return { ...data, span };
    }
    return data;
  }

  afterEvaluation?(
    hookContext: integrations.EvaluationHookContext,
    data: integrations.EvaluationHookData,
    _detail: LDEvaluationDetail,
  ): integrations.EvaluationHookData {
    const currentTrace = trace.getActiveSpan();
    if (currentTrace) {
      currentTrace.addEvent(FEATURE_FLAG_SCOPE, {
        [FEATURE_FLAG_KEY_ATTR]: hookContext.key,
        [FEATURE_FLAG_PROVIDER_ATTR]: this.getMetadata().name,
        [FEATURE_FLAG_CONTEXT_KEY]: Context.fromLDContext(hookContext.context).canonicalKey,
      });
    }

    (data as SpanTraceData).span?.end();
    return data;
  }
}
