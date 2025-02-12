import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk-common';

import { useLDClient } from '../useLDClient';

export const useTypedVariation = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): T => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean':
      return ldClient.boolVariation(key, defaultValue as boolean) as T;
    case 'number':
      return ldClient.numberVariation(key, defaultValue as number) as T;
    case 'string':
      return ldClient.stringVariation(key, defaultValue as string) as T;
    case 'undefined':
    case 'object':
      return ldClient.jsonVariation(key, defaultValue) as T;
    default:
      return ldClient.variation(key, defaultValue);
  }
};

export const useTypedVariationDetail = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean':
      return ldClient.boolVariationDetail(
        key,
        defaultValue as boolean,
      ) as LDEvaluationDetailTyped<T>;
    case 'number':
      return ldClient.numberVariationDetail(
        key,
        defaultValue as number,
      ) as LDEvaluationDetailTyped<T>;
    case 'string':
      return ldClient.stringVariationDetail(
        key,
        defaultValue as string,
      ) as LDEvaluationDetailTyped<T>;
    case 'undefined':
    case 'object':
      return ldClient.jsonVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
    default:
      return ldClient.variationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
  }
};
