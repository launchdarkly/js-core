'use client';

import { useContext, useEffect, useState } from 'react';

import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';
import type { LDFlagType } from './useFlag';

function getVariationDetail<T extends LDFlagType>(
  client: LDReactClient,
  key: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> {
  if (typeof defaultValue === 'boolean')
    return client.boolVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
  if (typeof defaultValue === 'string')
    return client.stringVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
  if (typeof defaultValue === 'number')
    return client.numberVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
  return client.jsonVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
}

/**
 * Returns the evaluation detail of a single feature flag, re-rendering only when that specific
 * flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The typed evaluation detail, including `value`, `variationIndex`, and `reason`.
 */
export function useFlagDetail<T extends LDFlagType>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<T> {
  const { client } = useContext(reactContext ?? LDReactContext);
  const [detail, setDetail] = useState<LDEvaluationDetailTyped<T>>(() =>
    getVariationDetail(client, key, defaultValue),
  );

  useEffect(() => {
    setDetail(getVariationDetail(client, key, defaultValue));
    const handler = () => setDetail(getVariationDetail(client, key, defaultValue));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, defaultValue]);

  return detail;
}
