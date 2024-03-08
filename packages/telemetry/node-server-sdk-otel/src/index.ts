// eslint-disable-next-line max-classes-per-file
import { context, propagation, Span, trace } from '@opentelemetry/api';

import type {
  EvaluationHook,
  EvaluationHookContext,
  EvaluationHookData,
  EvaluationHookMetadata,
  LDEvaluationDetail,
} from '@launchdarkly/node-server-sdk';
import { Context } from '@launchdarkly/node-server-sdk';

const FEATURE_FLAG_SCOPE = 'feature_flag';
const FEATURE_FLAG_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.key`;
const FEATURE_FLAG_PROVIDER_ATTR = `${FEATURE_FLAG_SCOPE}.provider_name`;
const FEATURE_FLAG_CONTEXT_KEY = `${FEATURE_FLAG_SCOPE}.context.key`;

type SpanTraceData = {
  span?: Span;
};

export class SpanTraceHook implements EvaluationHook {
  private readonly tracer = trace.getTracer('launchdarkly-client');

  getMetadata(): EvaluationHookMetadata {
    return {
      name: 'LaunchDarkly Tracing Hook',
    };
  }
  before?(hookContext: EvaluationHookContext, data: EvaluationHookData): void {
    const { canonicalKey } = Context.fromLDContext(hookContext.context);
    const currentTrace = trace.getActiveSpan();

    if (currentTrace) {
      currentTrace.setAttribute('feature_flag.context.key', canonicalKey);
    }

    const ctx = propagation.setBaggage(
      context.active(),
      propagation.createBaggage({
        'feature_flag.context.key': { value: canonicalKey },
      }),
    );

    const span = this.tracer.startSpan('launchdarkly.variation', undefined, ctx);
    // eslint-disable-next-line no-param-reassign
    data.span = span;
    span.setAttribute('feature_flag.context.key', canonicalKey);
  }
  after?(
    hookContext: EvaluationHookContext,
    data: EvaluationHookData,
    _detail: LDEvaluationDetail,
  ): void {
    (data as SpanTraceData).span?.end();
  }
}

export default class TracingHook implements EvaluationHook {
  getMetadata(): EvaluationHookMetadata {
    return {
      name: 'LaunchDarkly Tracing Hook',
    };
  }

  // before?(hookContext: EvaluationHookContext, data: EvaluationHookData): void {
  // }

  after?(
    hookContext: EvaluationHookContext,
    _data: EvaluationHookData,
    _detail: LDEvaluationDetail,
  ): void {
    const currentTrace = trace.getActiveSpan();
    if (currentTrace) {
      currentTrace.addEvent(FEATURE_FLAG_SCOPE, {
        [FEATURE_FLAG_KEY_ATTR]: hookContext.key,
        [FEATURE_FLAG_PROVIDER_ATTR]: this.getMetadata().name,
        [FEATURE_FLAG_CONTEXT_KEY]: Context.fromLDContext(hookContext.context).canonicalKey,
      });
    }
  }
}
