/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * TODO:
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import { useLDClient, useVariation } from './hooks';
import { setupPolyfill } from './polyfills';
import { LDProvider } from './provider';

setupPolyfill();

export * from '@launchdarkly/js-client-sdk-common';

export { LDProvider, useLDClient, useVariation };
