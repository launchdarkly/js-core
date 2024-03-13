// eslint-disable-next-line max-classes-per-file
import { Attributes, context, Span, trace } from '@opentelemetry/api';

import { Context, integrations, LDEvaluationDetail } from '@launchdarkly/node-server-sdk';

const FEATURE_FLAG_SCOPE = 'feature_flag';
const FEATURE_FLAG_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.key`;
const FEATURE_FLAG_PROVIDER_ATTR = `${FEATURE_FLAG_SCOPE}.provider_name`;
const FEATURE_FLAG_CONTEXT_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.context.key`;
const FEATURE_FLAG_VARIANT_ATTR = `${FEATURE_FLAG_SCOPE}.variant`;

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
  spans?: boolean;

  /**
   * If set to true, then the tracing hook will add the evaluated flag value
   * to span events and spans.
   *
   * The default is false.
   */
  includeVariant?: boolean;
}

type SpanTraceData = {
  span?: Span;
};

const defaultOptions: TracingHookOptions = {
  spans: false,
  includeVariant: false,
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
      span.setAttribute('feature_flag.key', hookContext.flagKey);

      return { ...data, span };
    }
    return data;
  }

  afterEvaluation?(
    hookContext: integrations.EvaluationHookContext,
    data: integrations.EvaluationHookData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationHookData {
    const currentTrace = trace.getActiveSpan();
    if (currentTrace) {
      const eventAttributes: Attributes = {
        [FEATURE_FLAG_KEY_ATTR]: hookContext.flagKey,
        [FEATURE_FLAG_PROVIDER_ATTR]: 'LaunchDarkly',
        [FEATURE_FLAG_CONTEXT_KEY_ATTR]: Context.fromLDContext(hookContext.context).canonicalKey,
      };
      if (this.options.includeVariant) {
        eventAttributes[FEATURE_FLAG_VARIANT_ATTR] = JSON.stringify(detail.value);
      }
      currentTrace.addEvent(FEATURE_FLAG_SCOPE, eventAttributes);
    }

    (data as SpanTraceData).span?.end();
    return data;
  }
}
