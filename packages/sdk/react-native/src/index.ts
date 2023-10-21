import init from './init';
import { setupPolyfill } from './polyfills';

setupPolyfill();

export * from '@launchdarkly/js-client-sdk-common';

export { init };
