// eslint-disable-next-line max-classes-per-file
import { Attributes, context, Span, trace } from '@opentelemetry/api';

import {
  basicLogger,
  Context,
  integrations,
  LDEvaluationDetail,
  LDLogger,
  OptionMessages,
  SafeLogger,
  TypeValidators,
} from '@launchdarkly/node-server-sdk';

const FEATURE_FLAG_SCOPE = 'feature_flag';
const FEATURE_FLAG_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.key`;
const FEATURE_FLAG_PROVIDER_ATTR = `${FEATURE_FLAG_SCOPE}.provider_name`;
const FEATURE_FLAG_CONTEXT_KEY_ATTR = `${FEATURE_FLAG_SCOPE}.context.key`;
const FEATURE_FLAG_VARIANT_ATTR = `${FEATURE_FLAG_SCOPE}.variant`;

const TRACING_HOOK_NAME = 'LaunchDarkly Tracing Hook';

/**
 * Options which allow configuring the tracing hook.
 */
export interface TracingHookOptions {
  /**
   * If set to true, then the tracing hook will add spans for each variation
   * method call. Span events are always added and are unaffected by this
   * setting.
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

  /**
   * Set to use a custom logging configuration, otherwise the logging will be done
   * using `console`.
   */
  logger?: LDLogger;
}

interface ValidatedHookOptions {
  spans: boolean;
  includeVariant: boolean;
  logger: LDLogger;
}

type SpanTraceData = {
  span?: Span;
};

const defaultOptions: ValidatedHookOptions = {
  spans: false,
  includeVariant: false,
  logger: basicLogger({ name: TRACING_HOOK_NAME }),
};

function validateOptions(options?: TracingHookOptions): ValidatedHookOptions {
  const validatedOptions: ValidatedHookOptions = { ...defaultOptions };

  if (options?.logger !== undefined) {
    validatedOptions.logger = new SafeLogger(options.logger, defaultOptions.logger);
  }

  if (options?.includeVariant !== undefined) {
    if (TypeValidators.Boolean.is(options.includeVariant)) {
      validatedOptions.includeVariant = options.includeVariant;
    } else {
      validatedOptions.logger.error(
        OptionMessages.wrongOptionType('includeVariant', 'boolean', typeof options?.includeVariant),
      );
    }
  }

  if (options?.spans !== undefined) {
    if (TypeValidators.Boolean.is(options.spans)) {
      validatedOptions.spans = options.spans;
    } else {
      validatedOptions.logger.error(
        OptionMessages.wrongOptionType('spans', 'boolean', typeof options?.spans),
      );
    }
  }

  return validatedOptions;
}

export default class TracingHook implements integrations.Hook {
  private readonly options: ValidatedHookOptions;
  private readonly tracer = trace.getTracer('launchdarkly-client');

  constructor(options?: TracingHookOptions) {
    this.options = validateOptions(options);
  }
  getMetadata(): integrations.HookMetadata {
    return {
      name: TRACING_HOOK_NAME,
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
