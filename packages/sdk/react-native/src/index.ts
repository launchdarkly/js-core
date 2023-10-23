/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * TODO: add rn sdk api docs
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import {
  useBoolVariation,
  useBoolVariationDetail,
  useJsonVariation,
  useJsonVariationDetail,
  useLDClient,
  useNumberVariation,
  useNumberVariationDetail,
  useStringVariation,
  useStringVariationDetail,
  useVariation,
  useVariationDetail,
} from './hooks';
import { setupPolyfill } from './polyfills';
import { LDProvider } from './provider';

setupPolyfill();

export * from '@launchdarkly/js-client-sdk-common';

export {
  LDProvider,
  useLDClient,
  useVariation,
  useVariationDetail,
  useNumberVariation,
  useNumberVariationDetail,
  useBoolVariation,
  useBoolVariationDetail,
  useStringVariation,
  useStringVariationDetail,
  useJsonVariationDetail,
  useJsonVariation,
};
