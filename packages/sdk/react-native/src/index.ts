import init from './init';
import setupPolyfills from './polyfills';

setupPolyfills();

export * from '@launchdarkly/js-client-sdk-common';

export { init };
