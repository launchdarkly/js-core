import {
  EventSource,
  EventSourceInitDict,
  Headers,
  Options,
  Requests,
  Response,
} from '@launchdarkly/js-sdk-common';

import promisify from '../../src/async/promisify';
import Requestor from '../../src/data_sources/Requestor';
import Configuration from '../../src/options/Configuration';

describe('given a requestor', () => {
  let requestor: Requestor;

  let requestsMade: Array<{ url: string; options: Options }>;

  let testHeaders: Record<string, string>;
  let testStatus = 200;
  let testResponse: string | undefined;
  let throwThis: string | undefined;

  function resetRequestState() {
    requestsMade = [];
    testHeaders = {};
    testStatus = 200;
    testResponse = undefined;
    throwThis = undefined;
  }

  beforeEach(() => {
    resetRequestState();

    const requests: Requests = {
      async fetch(url: string, options?: Options): Promise<Response> {
        return new Promise<Response>((a, r) => {
          if (throwThis) {
            r(new Error(throwThis));
          }
          const headers: Headers = {
            get(name: string): string | null {
              return testHeaders[name] || null;
            },
            keys(): Iterable<string> {
              throw new Error('Function not implemented.');
            },
            values(): Iterable<string> {
              throw new Error('Function not implemented.');
            },
            entries(): Iterable<[string, string]> {
              throw new Error('Function not implemented.');
            },
            has(_name: string): boolean {
              throw new Error('Function not implemented.');
            },
          };

          const res: Response = {
            headers,
            status: testStatus,
            async text(): Promise<string> {
              return testResponse ?? '';
            },
            json(): Promise<any> {
              throw new Error('Function not implemented.');
            },
          };
          requestsMade.push({ url, options: options! });
          a(res);
        });
      },

      createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
        throw new Error('Function not implemented.');
      },
      getEventSourceCapabilities() {
        throw new Error('Function not implemented.');
      },
    };

    requestor = new Requestor(new Configuration({}), requests, {
      authorization: 'sdkKey',
    });
  });

  it('gets data', (done) => {
    testResponse = 'a response';
    requestor.requestAllData((err, body) => {
      expect(err).toBeUndefined();
      expect(body).toEqual(testResponse);

      expect(requestsMade.length).toBe(1);
      expect(requestsMade[0].url).toBe('https://sdk.launchdarkly.com/sdk/poll');
      expect(requestsMade[0].options.headers?.authorization).toBe('sdkKey');

      done();
    });
  });

  it('includes basis query param when provided', (done) => {
    testResponse = 'a response';
    requestor.requestAllData(
      (err, body) => {
        expect(err).toBeUndefined();
        expect(body).toEqual(testResponse);

        expect(requestsMade.length).toBe(1);
        expect(requestsMade[0].url).toBe(
          'https://sdk.launchdarkly.com/sdk/poll?basis=bogusSelector',
        );
        expect(requestsMade[0].options.headers?.authorization).toBe('sdkKey');

        done();
      },
      [{ key: 'basis', value: 'bogusSelector' }],
    );
  });

  it('returns an error result for an http error', (done) => {
    testStatus = 401;
    requestor.requestAllData((err, _body) => {
      expect(err).toBeDefined();
      done();
    });
  });

  it('returns an error result for a network error', (done) => {
    throwThis = 'SOMETHING BAD';
    requestor.requestAllData((err, _body) => {
      expect(err.message).toBe(throwThis);
      done();
    });
  });

  it('stores and sends etags', async () => {
    testHeaders.etag = 'abc123';
    testResponse = 'a response';
    const res1 = await promisify<{ err: any; body: any }>((cb) => {
      requestor.requestAllData((err, body) => cb({ err, body }));
    });
    testStatus = 304;
    const res2 = await promisify<{ err: any; body: any }>((cb) => {
      requestor.requestAllData((err, body) => cb({ err, body }));
    });
    expect(res1.err).toBeUndefined();
    expect(res1.body).toEqual(testResponse);
    expect(res2.err).toBeUndefined();
    expect(res2.body).toEqual(null);

    const req1 = requestsMade[0];
    const req2 = requestsMade[1];
    expect(req1.options.headers?.['if-none-match']).toBe(undefined);
    expect(req2.options.headers?.['if-none-match']).toBe((testHeaders.etag = 'abc123'));
  });
});
