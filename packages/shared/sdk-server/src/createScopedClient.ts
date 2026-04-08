import {
  Context,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-sdk-common';

import { LDClient, LDScopedClient } from './api';

function setKind(
  kind: string,
  context: LDSingleKindContext,
  contextsByKind: Map<string, LDContextCommon>,
): void {
  const { kind: _, ...attrs } = context;
  contextsByKind.set(kind, attrs as LDContextCommon);
}

function buildContext(contextsByKind: Map<string, LDContextCommon>): LDContext {
  if (contextsByKind.size === 1) {
    const [kind, attrs] = contextsByKind.entries().next().value!;
    return { ...attrs, kind } as LDSingleKindContext;
  }

  const multi: LDMultiKindContext = { kind: 'multi' };
  contextsByKind.forEach((attrs, kind) => {
    multi[kind] = attrs;
  });
  return multi;
}

/**
 * Creates an {@link LDScopedClient} that wraps a base {@link LDClient}
 * with a mutable, additive context container.
 */
export default function createScopedClient(
  baseClient: LDClient,
  initialContext: LDContext,
): LDScopedClient {
  const contextsByKind: Map<string, LDContextCommon> = new Map();
  let cachedContext: LDContext | undefined;

  const parsed = Context.fromLDContext(initialContext);
  if (parsed.valid) {
    parsed.getContexts().forEach(([kind, attrs]) => {
      const { kind: _, ...rest } = attrs as LDContextCommon & { kind?: string };
      contextsByKind.set(kind, rest as LDContextCommon);
    });
  } else {
    baseClient.logger?.warn(
      'Scoped client created with invalid context; evaluations will use default values.',
    );
  }

  function currentContext(): LDContext {
    if (!cachedContext) {
      cachedContext = buildContext(contextsByKind);
    }
    return cachedContext;
  }

  function invalidateCache(): void {
    cachedContext = undefined;
  }

  const scopedClient: LDScopedClient = {
    client: baseClient,

    addContext(context: LDSingleKindContext): LDScopedClient {
      const { kind } = context;
      if (contextsByKind.has(kind)) {
        baseClient.logger?.warn(`Tried to add a duplicate ${kind} context to scoped client`);
        return scopedClient;
      }
      setKind(kind, context, contextsByKind);
      invalidateCache();
      return scopedClient;
    },

    overwriteContextByKind(context: LDSingleKindContext): LDScopedClient {
      setKind(context.kind, context, contextsByKind);
      invalidateCache();
      return scopedClient;
    },

    currentContext,

    variation: (key, defaultValue) => baseClient.variation(key, currentContext(), defaultValue),
    variationDetail: (key, defaultValue) =>
      baseClient.variationDetail(key, currentContext(), defaultValue),
    boolVariation: (key, defaultValue) =>
      baseClient.boolVariation(key, currentContext(), defaultValue),
    numberVariation: (key, defaultValue) =>
      baseClient.numberVariation(key, currentContext(), defaultValue),
    stringVariation: (key, defaultValue) =>
      baseClient.stringVariation(key, currentContext(), defaultValue),
    jsonVariation: (key, defaultValue) =>
      baseClient.jsonVariation(key, currentContext(), defaultValue),
    boolVariationDetail: (key, defaultValue) =>
      baseClient.boolVariationDetail(key, currentContext(), defaultValue),
    numberVariationDetail: (key, defaultValue) =>
      baseClient.numberVariationDetail(key, currentContext(), defaultValue),
    stringVariationDetail: (key, defaultValue) =>
      baseClient.stringVariationDetail(key, currentContext(), defaultValue),
    jsonVariationDetail: (key, defaultValue) =>
      baseClient.jsonVariationDetail(key, currentContext(), defaultValue),
    migrationVariation: (key, defaultValue) =>
      baseClient.migrationVariation(key, currentContext(), defaultValue),

    allFlagsState: (options?) => baseClient.allFlagsState(currentContext(), options),

    track: (key) => baseClient.track(key, currentContext()),
    trackData: (key, data) => baseClient.track(key, currentContext(), data),
    trackMetric: (key, metricValue, data?) =>
      baseClient.track(key, currentContext(), data, metricValue),
    trackMigration: (event) => baseClient.trackMigration(event),
  };

  return scopedClient;
}
