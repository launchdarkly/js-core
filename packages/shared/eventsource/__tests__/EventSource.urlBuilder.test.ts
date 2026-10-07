import { AsyncQueue, sleepAsync, withCloseable } from 'launchdarkly-js-test-helpers';

import { CLOSED, createEventSource, EventSource } from '../src/EventSource';
import { shouldReceiveMessages, withEventSource, withServer, writeEvents } from './helpers';

it('uses the url from urlBuilder for the first connection', async () => {
  await withServer(async (server) => {
    server.forMethodAndPath('get', '/built', writeEvents(['data: hello\n\n']));
    const opts = { urlBuilder: () => `${server.url}/built` };
    await withEventSource(`${server.url}/original`, opts, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
      expect((await server.nextRequest()).path).toEqual('/built');
    });
  });
});

// A longer timeout, not a shorter retry delay: these 3 reconnects normally finish in
// milliseconds, but a full-suite single-process run can leave leftover connections from
// earlier, unrelated test files that occasionally delay this test's reconnects past the
// default 5000ms test timeout. Not a correctness issue with urlBuilder itself.
it('calls urlBuilder again for each reconnection', async () => {
  await withServer(async (server) => {
    let attempt = 0;
    server.byDefault((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end();
    });
    const opts = {
      initialRetryDelayMillis: 1,
      urlBuilder: () => {
        attempt += 1;
        return `${server.url}/stream?attempt=${attempt}`;
      },
    };
    await withEventSource(server.url, opts, async () => {
      expect((await server.nextRequest()).path).toEqual('/stream?attempt=1');
      expect((await server.nextRequest()).path).toEqual('/stream?attempt=2');
      expect((await server.nextRequest()).path).toEqual('/stream?attempt=3');
    });
  });
}, 10000);

it('reports the url built for the current attempt', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    const built = `${server.url}/built`;
    await withCloseable(
      createEventSource(`${server.url}/original`, { urlBuilder: () => built }),
      async (es) => {
        es.onerror = () => {};
        expect(es.url).toEqual(built);
      },
    );
  });
});

it('does not start a request when urlBuilder closes the stream during a reconnect', async () => {
  let es: EventSource;
  let calls = 0;
  await withServer(async (server) => {
    let requests = 0;
    server.byDefault((_req, res) => {
      requests += 1;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end();
    });
    const closed = new AsyncQueue<unknown>();
    es = createEventSource(server.url, {
      initialRetryDelayMillis: 1,
      urlBuilder: () => {
        calls += 1;
        if (calls === 2) {
          es.close();
        }
        return server.url;
      },
    });
    es.onerror = () => {};
    es.addEventListener('closed', (e) => closed.add(e));
    try {
      await closed.take();
      // A request that the close failed to stop would land on the server within this window.
      await sleepAsync(100);
      expect(calls).toEqual(2);
      expect(requests).toEqual(1);
      expect(es.readyState).toEqual(CLOSED);
    } finally {
      es.close();
    }
  });
}, 10000);

it('reports a failure instead of wedging when urlBuilder throws', async () => {
  await withServer(async (server) => {
    let calls = 0;
    const errors: { message?: string }[] = [];
    // errorFilter, not onerror, is what observes the very first failure here: urlBuilder throws
    // synchronously from inside createEventSource(), before that call has even returned control
    // to this test, so an `onerror` assigned afterward would miss it. errorFilter runs inside
    // that same synchronous call and is supplied up front via the init options, so it cannot
    // miss it. Returning false also stops the default "always retry" policy for this one throw,
    // so the assertions below don't race a scheduled reconnect.
    const es = createEventSource(server.url, {
      urlBuilder: () => {
        calls += 1;
        throw new Error('boom');
      },
      errorFilter: (e) => {
        errors.push(e);
        return false;
      },
    });
    await withCloseable(es, async () => {
      await sleepAsync(50);
      expect(calls).toBe(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('boom');
      expect(es.readyState).toBe(CLOSED);
    });
  });
});
