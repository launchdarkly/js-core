import type { LDContext, LDFlagValue } from '@launchdarkly/node-server-sdk';

import { useLDClientRsc } from '../useLDClientRsc';

export const useVariationRsc = async (key: string, context: LDContext, def?: LDFlagValue) => {
  const ldc = await useLDClientRsc(context);
  return ldc.variation(key, def);
};

export const useVariationDetailRsc = async (key: string, context: LDContext, def?: LDFlagValue) => {
  const ldc = await useLDClientRsc(context);
  return ldc.variationDetail(key, def);
};
