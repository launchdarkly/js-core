import BrowserInfo from './platform/BrowserInfo';
import DefaultBrowserEventSource from './platform/DefaultBrowserEventSource';

// Temporary exports for testing in a browser.
export { DefaultBrowserEventSource, BrowserInfo };
export * from '@launchdarkly/js-client-sdk-common';

export function Hello() {
  // eslint-disable-next-line no-console
  console.log('HELLO');
}
