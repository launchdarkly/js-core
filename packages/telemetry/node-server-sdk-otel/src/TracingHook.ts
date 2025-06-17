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
const FEATURE_FLAG_PROVIDER_ATTR = `${FEATURE_FLAG_SCOPE}.provider.name`;
const FEATURE_FLAG_CONTEXT_ID_ATTR = `${FEATURE_FLAG_SCOPE}.context.id`;
const FEATURE_FLAG_RESULT_ATTR = `${FEATURE_FLAG_SCOPE}.result`;
const FEATURE_FLAG_VALUE_ATTR = `${FEATURE_FLAG_RESULT_ATTR}.value`;
const FEATURE_FLAG_VARIATION_INDEX_ATTR = `${FEATURE_FLAG_RESULT_ATTR}.variationIndex`;
const FEATURE_FLAG_REASON_ATTR = `${FEATURE_FLAG_RESULT_ATTR}.reason`;
const FEATURE_FLAG_IN_EXPERIMENT_ATTR = `${FEATURE_FLAG_REASON_ATTR}.inExperiment`;
const FEATURE_FLAG_SET_ID = `${FEATURE_FLAG_SCOPE}.set.id`;

const TRACING_HOOK_NAME = 'LaunchDarkly Tracing Hook';

/**
 * Options which allow configuring the tracing hook.
 */
export interface TracingHookOptions {
  /**
   * Experimental: If set to true, then the tracing hook will add spans for each variation
   * method call. Span events are always added and are unaffected by this
   * setting.
   *
   * The default value is false.
   *
   * This feature is experimental and the data in the spans, or nesting of spans,
   * could change in future versions.
   */
  spans?: boolean;

  /**
   * If set to true, then the tracing hook will add the evaluated flag value
   * to span events and spans.
   *
   * The default is false.
   *
   * @deprecated This option is deprecated and will be removed in a future version.
   * This has been replaced by `includeValue`. If both are set, `includeValue` will take precedence.
   */
  includeVariant?: boolean;

  /**
   * If set to true, then the tracing hook will add the evaluated flag value
   * to span events and spans.
   *
   * The default is false.
   */
  includeValue?: boolean;

  /**
   * Set to use a custom logging configuration, otherwise the logging will be done
   * using `console`.
   */
  logger?: LDLogger;

  environmentId?: string;
}

interface ValidatedHookOptions {
  spans: boolean;
  includeValue: boolean;
  logger: LDLogger;
  environmentId?: string;
}

type SpanTraceData = {
  span?: Span;
};

const defaultOptions: ValidatedHookOptions = {
  spans: false,
  includeValue: false,
  logger: basicLogger({ name: TRACING_HOOK_NAME }),
  environmentId: undefined,
};

function validateOptions(options?: TracingHookOptions): ValidatedHookOptions {
  const validatedOptions: ValidatedHookOptions = { ...defaultOptions };

  if (options?.logger !== undefined) {
    validatedOptions.logger = new SafeLogger(options.logger, defaultOptions.logger);
  }

  if (options?.includeValue !== undefined) {
    if (TypeValidators.Boolean.is(options.includeValue)) {
      validatedOptions.includeValue = options.includeValue;
    } else {
      validatedOptions.logger.error(
        OptionMessages.wrongOptionType('includeValue', 'boolean', typeof options?.includeValue),
      );
    }
  } else if (options?.includeVariant !== undefined) {
    if (TypeValidators.Boolean.is(options.includeVariant)) {
      validatedOptions.includeValue = options.includeVariant;
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

  if (options?.environmentId !== undefined) {
    if (TypeValidators.String.is(options.environmentId)) {
      validatedOptions.environmentId = options.environmentId;
    } else {
      validatedOptions.logger.error(
        OptionMessages.wrongOptionType('environmentId', 'string', typeof options?.environmentId),
      );
    }
  }

  return validatedOptions;
}

/**
 * The TracingHook adds OpenTelemetry support to the LaunchDarkly SDK.
 *
 * By default, span events will be added for each call to a "Variation" method.
 *
 * The span event will include the canonicalKey of the context, the provider of the evaluation
 * (LaunchDarkly), and the key of the flag being evaluated.
 */
export default class TracingHook implements integrations.Hook {
  private readonly _options: ValidatedHookOptions;
  private readonly _tracer = trace.getTracer('launchdarkly-client');

  /**
   * Construct a TracingHook with the given options.
   *
   * @param options Options to customize tracing behavior.
   */
  constructor(options?: TracingHookOptions) {
    this._options = validateOptions(options);
  }

  /**
   * Get the meta-data for the tracing hook.
   */
  getMetadata(): integrations.HookMetadata {
    return {
      name: TRACING_HOOK_NAME,
    };
  }

  /**
   * Implements the "beforeEvaluation" stage of the TracingHook.
   */
  beforeEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ): integrations.EvaluationSeriesData {
    if (this._options.spans) {
      const { canonicalKey } = Context.fromLDContext(hookContext.context);

      const span = this._tracer.startSpan(hookContext.method, undefined, context.active());
      span.setAttribute(FEATURE_FLAG_CONTEXT_ID_ATTR, canonicalKey);
      span.setAttribute(FEATURE_FLAG_KEY_ATTR, hookContext.flagKey);

      return { ...data, span };
    }
    return data;
  }

  /**
   * Implements the "afterEvaluation" stage of the TracingHook.
   */
  afterEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationSeriesData {
    (data as SpanTraceData).span?.end();

    const currentTrace = trace.getActiveSpan();
    if (currentTrace) {
      const eventAttributes: Attributes = {
        [FEATURE_FLAG_KEY_ATTR]: hookContext.flagKey,
        [FEATURE_FLAG_PROVIDER_ATTR]: 'LaunchDarkly',
        [FEATURE_FLAG_CONTEXT_ID_ATTR]: Context.fromLDContext(hookContext.context).canonicalKey,
      };
      if (typeof detail.variationIndex === 'number') {
        eventAttributes[FEATURE_FLAG_VARIATION_INDEX_ATTR] = detail.variationIndex;
      }
      if (detail.reason.inExperiment) {
        eventAttributes[FEATURE_FLAG_IN_EXPERIMENT_ATTR] = detail.reason.inExperiment;
      }
      if (this._options.environmentId) {
        eventAttributes[FEATURE_FLAG_SET_ID] = this._options.environmentId;
      } else if (hookContext.environmentId) {
        eventAttributes[FEATURE_FLAG_SET_ID] = hookContext.environmentId;
      }
      if (this._options.includeValue) {
        eventAttributes[FEATURE_FLAG_VALUE_ATTR] = JSON.stringify(detail.value);
      }
      currentTrace.addEvent(FEATURE_FLAG_SCOPE, eventAttributes);
    }

    return data;
  }
}
