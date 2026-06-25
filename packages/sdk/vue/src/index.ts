/**
 * This is the API reference for the LaunchDarkly Client-side SDK for Vue.
 *
 * In typical usage you wrap your app in a provider from {@link createLDProvider} (or install the
 * {@link LDVuePlugin}), then read flags reactively with the variation composables.
 *
 * @packageDocumentation
 */
export * from './client';
export { LDVuePlugin, type LDVuePluginOptions } from './plugin';

// Commonly used types from the base SDK.
export type {
  LDClient,
  LDContext,
  LDContextStrict,
  LDOptions,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
  LDFlagSet,
  LDFlagValue,
  LDInspection,
  LDLogger,
  Hook,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';
