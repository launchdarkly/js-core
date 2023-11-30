import { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk-common';

import useLDClient from '../useLDClient';

export const useTypedVariation = <T extends boolean | number | string | unknown>(
  flagKey: string,
  defaultValue: T,
): T => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean':
      return ldClient.boolVariation(flagKey, defaultValue as boolean) as T;
    case 'number':
      return ldClient.numberVariation(flagKey, defaultValue as number) as T;
    case 'string':
      return ldClient.stringVariation(flagKey, defaultValue as string) as T;
    case 'undefined':
    case 'object':
      return ldClient.jsonVariation(flagKey, defaultValue) as T;
    default:
      return ldClient.variation(flagKey, defaultValue);
  }
};

export const useTypedVariationDetail = <T extends boolean | number | string | unknown>(
  flagKey: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> => {
  const ldClient = useLDClient();

  switch (typeof defaultValue) {
    case 'boolean':
      return ldClient.boolVariationDetail(
        flagKey,
        defaultValue as boolean,
      ) as LDEvaluationDetailTyped<T>;
    case 'number':
      return ldClient.numberVariationDetail(
        flagKey,
        defaultValue as number,
      ) as LDEvaluationDetailTyped<T>;
    case 'string':
      return ldClient.stringVariationDetail(
        flagKey,
        defaultValue as string,
      ) as LDEvaluationDetailTyped<T>;
    case 'undefined':
    case 'object':
      return ldClient.jsonVariationDetail(flagKey, defaultValue) as LDEvaluationDetailTyped<T>;
    default:
      return ldClient.variationDetail(flagKey, defaultValue);
  }
};
