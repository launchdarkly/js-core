import { diff } from 'jest-diff';
import { Options } from '../../src/platform';

export const SDK_KEY = 'test-key';
export const DEFAULT_URL = 'https://events.launchdarkly.com/bulk';

interface CustomMatchers<R = unknown> {
  toMatchEvents(body: any): R;
}

declare global {
  namespace jest {
    interface Expect extends CustomMatchers { }
    interface Matchers<R> extends CustomMatchers<R> { }
    interface InverseAsymmetricMatchers extends CustomMatchers { }
  }
}
expect.extend({
  toMatchEvents(
    received: { url: string; options: Options; },
    body: any,
  ): { pass: boolean; message: () => string; } {
    const { url, options } = received;
    const headers = {
      authorization: SDK_KEY,
      'user-agent': 'NodeJSClient/2.0.2',
      'x-launchDarkly-event-schema': '4',
      'x-launchdarkly-payload-id': '',
    };

    const urlMatch = url === DEFAULT_URL;

    if (!urlMatch) {
      return { pass: false, message: () => this.utils.matcherHint('toMatchEvents - url', url, DEFAULT_URL) };
    }

    const headerMatch = options.headers!.authorization === headers.authorization
      && options.headers!['user-agent'] === headers['user-agent']
      && options.headers!['x-launchDarkly-event-schema'] === headers['x-launchDarkly-event-schema']
      && typeof options.headers!['x-launchdarkly-payload-id'] === 'string';

    if (!headerMatch) {
      return { pass: false, message: () => this.utils.matcherHint('toMatchEvents - headers', JSON.stringify(options.headers), JSON.stringify(headers)) };
    }
    const bodyMatch = this.equals(JSON.parse(options.body!), body);
    if (!bodyMatch) {
      // const stringBody = JSON.stringify(body);
      const diffString = diff(body, JSON.parse(options.body!), {
        expand: this.expand,
      });
      return {
        pass: false,
        message: () => `${this.utils.matcherHint('toBe', undefined, undefined, undefined)}\n\n${diffString && diffString.includes('- Expect')
          ? `Difference:\n\n${diffString}`
          : `Expected: ${this.utils.printExpected(body)}\n`
          + `Received: ${this.utils.printReceived(received)}`}`,
      };
    }
    return { pass: true, message: () => '' };
  },
});
