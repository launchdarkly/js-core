import { TestHttpHandlers, TestHttpHeaders } from 'launchdarkly-js-test-helpers';

import {
  shouldReceiveMessages,
  startErrorQueue,
  withEventSource,
  withSecureServer,
  withServer,
  writeEvents,
} from './helpers';

function stripIrrelevantHeaders(headers: TestHttpHeaders): TestHttpHeaders {
  const h = { ...headers };
  delete h.connection;
  delete h.host;
  return h;
}

it('passes cache-control: no-cache to the server', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async () => {
      const req = await server.nextRequest();
      expect(req.headers['cache-control']).toEqual('no-cache');
    });
  });
});

it('sets request headers', async () => {
  await withServer(async (server) => {
    const headers = {
      'User-Agent': 'test',
      Cookie: 'test=test',
      'Last-Event-ID': '99',
    };
    await withEventSource(server.url, { headers }, async () => {
      const req = await server.nextRequest();
      expect(stripIrrelevantHeaders(req.headers)).toEqual({
        accept: 'text/event-stream',
        'cache-control': 'no-cache',
        'user-agent': 'test',
        cookie: 'test=test',
        'last-event-id': '99',
      });
    });
  });
});

it('can omit default headers', async () => {
  await withServer(async (server) => {
    const headers = {
      'User-Agent': 'test',
      Cookie: 'test=test',
      'Last-Event-ID': '99',
    };
    await withEventSource(server.url, { headers, skipDefaultHeaders: true }, async () => {
      const req = await server.nextRequest();
      expect(stripIrrelevantHeaders(req.headers)).toEqual({
        'user-agent': 'test',
        cookie: 'test=test',
        'last-event-id': '99',
      });
    });
  });
});

it('uses the GET method by default', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async () => {
      const req = await server.nextRequest();
      expect(req.method).toEqual('get');
    });
  });
});

it('can specify HTTP method and body', async () => {
  const content = '{ "test": true }';
  await withServer(async (server) => {
    await withEventSource(server.url, { method: 'POST', body: content }, async () => {
      const req = await server.nextRequest();
      expect(req.method).toEqual('post');
      expect(req.body).toEqual(content);
    });
  });
});

it('sends the Last-Event-ID header when one was specified in the constructor', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, { headers: { 'Last-Event-ID': '9' } }, async () => {
      const req = await server.nextRequest();
      expect(req.headers['last-event-id']).toEqual('9');
    });
  });
});

describe.each([301, 307])('given a %s redirect response', (status) => {
  it('follows the redirect', async () => {
    const redirectSuffix = '/foobar';
    await withServer(async (server) => {
      server.forMethodAndPath(
        'get',
        '/',
        TestHttpHandlers.respond(status, {
          Connection: 'Close',
          Location: server.url + redirectSuffix,
        }),
      );
      server.forMethodAndPath('get', redirectSuffix, writeEvents(['data: hello\n\n']));

      await withEventSource(server.url, undefined, async () => {
        const request1 = await server.nextRequest();
        expect(request1.path).toEqual('/');

        const request2 = await server.nextRequest();
        expect(request2.path).toEqual(redirectSuffix);
      });
    });
  });

  it('emits an error event when the Location header is missing', async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(status, { Connection: 'Close' }));
      await withEventSource(server.url, undefined, async (es) => {
        const errors = startErrorQueue(es);
        const err = await errors.take();
        expect(err.status).toEqual(status);
      });
    });
  });
});

describe.each([401, 403])('given a %s response', (status) => {
  it('emits an error event with the status and headers', async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(status));
      await withEventSource(server.url, undefined, async (es) => {
        const errors = startErrorQueue(es);
        const err = await errors.take();
        expect(err.status).toEqual(status);
        expect(err.headers).not.toBeUndefined();
      });
    });
  });
});

it('uses https for https urls', async () => {
  await withSecureServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, { rejectUnauthorized: false }, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
    });
  });
});

it('merges https options into the request', async () => {
  await withSecureServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(
      server.url,
      { https: { rejectUnauthorized: true, ca: server.certificate } },
      async (es) => {
        await shouldReceiveMessages(es, [{ data: 'hello' }]);
      },
    );
  });
});

it('fails when https options are not merged and the certificate is unverifiable', async () => {
  await withSecureServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, { https: { rejectUnauthorized: true } }, async (es) => {
      const errors = startErrorQueue(es);
      const err = await errors.take();
      expect(err.message).toMatch(/self.signed/i);
    });
  });
});
