'use client';

import type { LDReactClientContextValue } from '../LDClient';
import useVariationCore from './useVariationCore';

/**
 * Returns the boolean variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The boolean flag value, or `defaultValue` if the flag is unavailable.
 */
export function useBoolVariation(
  key: string,
  defaultValue: boolean,
  reactContext?: React.Context<LDReactClientContextValue>,
): boolean {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.boolVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the string variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The string flag value, or `defaultValue` if the flag is unavailable.
 */
export function useStringVariation(
  key: string,
  defaultValue: string,
  reactContext?: React.Context<LDReactClientContextValue>,
): string {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.stringVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the numeric variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The number flag value, or `defaultValue` if the flag is unavailable.
 */
export function useNumberVariation(
  key: string,
  defaultValue: number,
  reactContext?: React.Context<LDReactClientContextValue>,
): number {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.numberVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the JSON variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The JSON flag value, or `defaultValue` if the flag is unavailable.
 */
export function useJsonVariation<T = unknown>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariation(k, def) as T,
    reactContext,
  );
}
