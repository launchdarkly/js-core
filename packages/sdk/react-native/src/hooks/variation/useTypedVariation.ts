import { useEffect, useRef, useState } from 'react';

import type ReactNativeLDClient from '../../ReactNativeLDClient';
import useLDClient from '../useLDClient';
import { LDEvaluationDetailTyped } from './LDEvaluationDetail';

function getTypedVariation<T extends boolean | number | string | unknown>(
  ldClient: ReactNativeLDClient,
  key: string,
  defaultValue: T,
): T {
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
}

/**
 * Determines the strongly typed variation of a feature flag.
 *
 * @param key The unique key of the feature flag.
 * @param defaultValue The default value of the flag, to be used if the value is not available
 *   from LaunchDarkly.
 * @returns
 *   The strongly typed value.
 */
export const useTypedVariation = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): T => {
  const ldClient = useLDClient();
  const [value, setValue] = useState<T>(() =>
    ldClient ? getTypedVariation(ldClient, key, defaultValue) : defaultValue,
  );
  const valueRef = useRef<T>(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setValue(getTypedVariation(ldClient, key, defaultValue));
    const handleChange = (): void => {
      const newValue = getTypedVariation(ldClient, key, defaultValue);
      if (newValue !== valueRef.current) {
        setValue(newValue);
      }
    };
    ldClient.on('change', handleChange);
    return () => {
      ldClient.off('change', handleChange);
    };
  }, [key, defaultValue]);

  return value;
};

function getTypedVariationDetail<T extends boolean | number | string | unknown>(
  ldClient: ReactNativeLDClient,
  key: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> {
  let detail: LDEvaluationDetailTyped<T>;
  switch (typeof defaultValue) {
    case 'boolean': {
      detail = ldClient.boolVariationDetail(
        key,
        defaultValue as boolean,
      ) as LDEvaluationDetailTyped<T>;
      break;
    }
    case 'number': {
      detail = ldClient.numberVariationDetail(
        key,
        defaultValue as number,
      ) as LDEvaluationDetailTyped<T>;
      break;
    }
    case 'string': {
      detail = ldClient.stringVariationDetail(
        key,
        defaultValue as string,
      ) as LDEvaluationDetailTyped<T>;
      break;
    }
    case 'undefined':
    case 'object': {
      detail = ldClient.jsonVariationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
      break;
    }
    default: {
      detail = ldClient.variationDetail(key, defaultValue) as LDEvaluationDetailTyped<T>;
      break;
    }
  }
  return { ...detail, reason: detail.reason ?? null };
}

/**
 * Determines the strongly typed variation of a feature flag for a context, along with information about
 * how it was calculated.
 *
 * The `reason` property of the result will also be included in analytics events, if you are
 * capturing detailed event data for this flag.
 *
 * If the flag variation does not have the specified type, defaultValue is returned. The reason will
 * indicate an error of the type `WRONG_KIND` in this case.
 *
 * For more information, see the [SDK reference
 * guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#react-native).
 *
 * @param key The unique key of the feature flag.
 * @param defaultValue The default value of the flag, to be used if the value is not available
 *   from LaunchDarkly.
 * @returns
 *  The result (as an {@link LDEvaluationDetailTyped<T>}).
 */
export const useTypedVariationDetail = <T extends boolean | number | string | unknown>(
  key: string,
  defaultValue: T,
): LDEvaluationDetailTyped<T> => {
  const ldClient = useLDClient();
  const [detail, setDetail] = useState<LDEvaluationDetailTyped<T>>(() =>
    ldClient
      ? getTypedVariationDetail(ldClient, key, defaultValue)
      : { value: defaultValue, reason: null },
  );
  const detailRef = useRef<LDEvaluationDetailTyped<T>>(detail);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    setDetail(getTypedVariationDetail(ldClient, key, defaultValue));
    const handleChange = () => {
      const newDetail = getTypedVariationDetail(ldClient, key, defaultValue);
      if (newDetail.value !== detailRef.current.value) {
        setDetail(newDetail);
      }
    };
    ldClient.on('change', handleChange);
    return () => {
      ldClient.off('change', handleChange);
    };
  }, [key, defaultValue]);

  return detail;
};
