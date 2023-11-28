/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * TODO:
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import { setupPolyfill } from './polyfills';
import ReactNativeLDClient from './ReactNativeLDClient';

setupPolyfill();

export * from '@launchdarkly/js-client-sdk-common';

export * from './hooks';
export * from './provider';
export { ReactNativeLDClient };
