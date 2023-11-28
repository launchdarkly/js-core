import { useTypedVariation, useTypedVariationDetail } from './useTypedVariation';

export const useBoolVariation = (flagKey: string, defaultValue: boolean) =>
  useTypedVariation<boolean>(flagKey, defaultValue);

export const useBoolVariationDetail = (flagKey: string, defaultValue: boolean) =>
  useTypedVariationDetail<boolean>(flagKey, defaultValue);

export const useNumberVariation = (flagKey: string, defaultValue: number) =>
  useTypedVariation<number>(flagKey, defaultValue);

export const useNumberVariationDetail = (flagKey: string, defaultValue: number) =>
  useTypedVariationDetail<number>(flagKey, defaultValue);

export const useStringVariation = (flagKey: string, defaultValue: string) =>
  useTypedVariation<string>(flagKey, defaultValue);

export const useStringVariationDetail = (flagKey: string, defaultValue: string) =>
  useTypedVariationDetail<string>(flagKey, defaultValue);

export const useJsonVariation = (flagKey: string, defaultValue: unknown) =>
  useTypedVariation<unknown>(flagKey, defaultValue);

export const useJsonVariationDetail = (flagKey: string, defaultValue: unknown) =>
  useTypedVariationDetail<unknown>(flagKey, defaultValue);
