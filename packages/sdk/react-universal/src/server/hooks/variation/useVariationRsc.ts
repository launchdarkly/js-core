import type { LDContext, LDFlagValue } from '@launchdarkly/node-server-sdk';

import { useLDClientRsc } from '../useLDClientRsc';

export const useBoolVariationRsc = async (key: string, context: LDContext, def: boolean) => {
  const ldc = await useLDClientRsc(context);
  return ldc.boolVariation(key, def);
};

export const useStringVariationRsc = async (key: string, context: LDContext, def: string) => {
  const ldc = await useLDClientRsc(context);
  return ldc.stringVariation(key, def);
};

export const useNumberVariationRsc = async (key: string, context: LDContext, def: number) => {
  const ldc = await useLDClientRsc(context);
  return ldc.numberVariation(key, def);
};

export const useJsonVariationRsc = async (key: string, context: LDContext, def: undefined) => {
  const ldc = await useLDClientRsc(context);
  return ldc.jsonVariation(key, def);
};

export const useVariationRsc = async (key: string, context: LDContext, def?: LDFlagValue) => {
  const ldc = await useLDClientRsc(context);
  return ldc.variation(key, def);
};

export const useBoolVariationDetailRsc = async (key: string, context: LDContext, def: boolean) => {
  const ldc = await useLDClientRsc(context);
  return ldc.boolVariationDetail(key, def);
};

export const useStringVariationDetailRsc = async (key: string, context: LDContext, def: string) => {
  const ldc = await useLDClientRsc(context);
  return ldc.stringVariationDetail(key, def);
};

export const useNumberVariationDetailRsc = async (key: string, context: LDContext, def: number) => {
  const ldc = await useLDClientRsc(context);
  return ldc.numberVariationDetail(key, def);
};

export const useJsonVariationDetailRsc = async (
  key: string,
  context: LDContext,
  def: undefined,
) => {
  const ldc = await useLDClientRsc(context);
  return ldc.jsonVariationDetail(key, def);
};

export const useVariationDetailRsc = async (key: string, context: LDContext, def?: LDFlagValue) => {
  const ldc = await useLDClientRsc(context);
  return ldc.variationDetail(key, def);
};
