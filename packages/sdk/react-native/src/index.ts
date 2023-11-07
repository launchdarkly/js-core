/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * TODO:
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import init from './init';
import { setupPolyfill } from './polyfills';

setupPolyfill();

export * from '@launchdarkly/js-client-sdk-common';

export { init };
