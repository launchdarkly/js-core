import { AsyncQueue, TestHttpHandlers, TestHttpHeaders } from 'launchdarkly-js-test-helpers';

import {
  shouldReceiveMessages,
  startErrorQueue,
  withEventSource,
  withServer,
  writeEvents,
} from './helpers';

function stripIrrelevantHeaders(headers: TestHttpHeaders): TestHttpHeaders {
  const h = { ...headers };
  delete h.connection;
  delete h.host;
  // fetch() adds these itself; they are not part of what this implementation controls.
  delete h['accept-encoding'];
  delete h['accept-language'];
  delete h['sec-fetch-mode'];
  delete h['user-agent'];
  // fetch() supplies this default itself when the implementation sends no Accept header at all
  // (e.g. skipDefaultHeaders); an explicit Accept value set by the implementation is left alone.
  if (h.accept === '*/*') {
    delete h.accept;
  }
  delete h['content-length'];
  delete h['content-type'];
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
    // Deliberately not `User-Agent`/`Cookie`: those are forbidden
    // header names in a real browser and would be dropped by the user agent even though undici
    // lets them through here.
    const headers = {
      'X-Custom': 'test',
      'Last-Event-ID': '99',
    };
    await withEventSource(server.url, { headers }, async () => {
      const req = await server.nextRequest();
      expect(stripIrrelevantHeaders(req.headers)).toEqual({
        accept: 'text/event-stream',
        'cache-control': 'no-cache',
        'x-custom': 'test',
        'last-event-id': '99',
      });
    });
  });
});

it('joins a multi-valued header into a single value', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, { headers: { 'X-Multi': ['a', 'b'] } }, async () => {
      const req = await server.nextRequest();
      expect(req.headers['x-multi']).toEqual('a, b');
    });
  });
});

it('can omit default headers', async () => {
  await withServer(async (server) => {
    const headers = {
      'X-Custom': 'test',
      'Last-Event-ID': '99',
    };
    await withEventSource(server.url, { headers, skipDefaultHeaders: true }, async () => {
      const req = await server.nextRequest();
      expect(stripIrrelevantHeaders(req.headers)).toEqual({
        'x-custom': 'test',
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

it('omits a body configured alongside the default GET method', async () => {
  // A fetch() request with GET or HEAD may not carry a body: passing one is a TypeError, which
  // would turn a misconfiguration into an endless retry loop. The body is dropped instead.
  await withServer(async (server) => {
    await withEventSource(server.url, { body: 'ignored' }, async () => {
      const req = await server.nextRequest();
      expect(req.method).toEqual('get');
      expect(req.body).toBeFalsy();
    });
  });
});

it('sends the Last-Event-ID header when one was specified in the init options', async () => {
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

      await withEventSource(server.url, undefined, async (es) => {
        await shouldReceiveMessages(es, [{ data: 'hello' }]);

        const request1 = await server.nextRequest();
        expect(request1.path).toEqual('/');

        const request2 = await server.nextRequest();
        expect(request2.path).toEqual(redirectSuffix);
      });
    });
  });

  it('emits an error event when the Location header is missing', async () => {
    // A redirect that cannot be followed is handed back with its own status, which this
    // implementation treats like any other non-200.
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(status, { Connection: 'Close' }));
      await withEventSource(server.url, undefined, async (es) => {
        const errors = startErrorQueue(es);
        const err = await errors.take();
        expect(err.status).toEqual(status);
      });
    });
  });

  it('reconnects to the original url rather than the redirect target', async () => {
    // fetch() follows redirects itself, so the redirect target is never observable here and every
    // attempt starts from the configured url. That matches the original Node implementation for a 307 (which restores the
    // original url before reconnecting); it differs for a 301, where the original Node implementation pins the new url and
    // this implementation re-follows the redirect on each attempt instead.
    await withServer(async (server) => {
      server.forMethodAndPath(
        'get',
        '/',
        TestHttpHandlers.respond(status, {
          Connection: 'Close',
          Location: `${server.url}/redirected`,
        }),
      );
      server.forMethodAndPath('get', '/redirected', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end();
      });

      await withEventSource(server.url, { initialRetryDelayMillis: 1 }, async () => {
        expect((await server.nextRequest()).path).toEqual('/');
        expect((await server.nextRequest()).path).toEqual('/redirected');
        expect((await server.nextRequest()).path).toEqual('/');
        expect((await server.nextRequest()).path).toEqual('/redirected');
      });
    });
  });
});

it('preserves the method and body across a 307 redirect', async () => {
  const content = '{ "test": true }';
  await withServer(async (server) => {
    server.forMethodAndPath(
      'post',
      '/',
      TestHttpHandlers.respond(307, {
        Connection: 'Close',
        Location: `${server.url}/redirected`,
      }),
    );
    server.forMethodAndPath('post', '/redirected', writeEvents(['data: hello\n\n']));

    await withEventSource(server.url, { method: 'POST', body: content }, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);

      const request1 = await server.nextRequest();
      expect(request1.method).toEqual('post');
      expect(request1.path).toEqual('/');

      const request2 = await server.nextRequest();
      expect(request2.method).toEqual('post');
      expect(request2.path).toEqual('/redirected');
      expect(request2.body).toEqual(content);
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

it('fails when a 200 response declares a content type other than text/event-stream', async () => {
  await withServer(async (server) => {
    server.byDefault(
      TestHttpHandlers.respond(200, { 'Content-Type': 'text/html' }, '<html></html>'),
    );
    await withEventSource(server.url, undefined, async (es) => {
      const errors = startErrorQueue(es);
      const err = await errors.take();
      expect(err.status).toEqual(200);
      expect(err.message).toContain('text/event-stream');
    });
  });
});

it('accepts an event-stream content type that carries parameters', async () => {
  await withServer(async (server) => {
    const chunks = new AsyncQueue<string>();
    chunks.add('data: hello\n\n');
    server.byDefault(
      TestHttpHandlers.chunkedStream(
        200,
        { 'Content-Type': 'text/event-stream; charset=utf-8' },
        chunks,
      ),
    );
    await withEventSource(server.url, undefined, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
    });
  });
});
