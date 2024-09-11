import DefaultBrowserEventSource from './platform/DefaultBrowserEventSource';

// Temporary exports for testing the events source in a browser.
export { DefaultBrowserEventSource };
export * from '@launchdarkly/js-client-sdk-common';

export function Hello() {
  // eslint-disable-next-line no-console
  console.log('HELLO');
}
