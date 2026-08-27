import { AsyncQueue, sleepAsync } from 'launchdarkly-js-test-helpers';

import { MessageEvent, OpenEvent } from '../src/types';
import {
  expectNothingReceived,
  startErrorQueue,
  startMessageQueue,
  waitForOpenEvent,
  withEventSource,
  withServer,
  writeEvents,
} from './helpers';

it('calls onopen when the connection is established', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      const opened = new AsyncQueue<OpenEvent>();
      es.onopen = (e) => opened.add(e);
      const e = await opened.take();
      expect(e.type).toEqual('open');
    });
  });
});

it('emits the open event with response headers', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([], { 'X-LD-EnvId': '12345' }));
    await withEventSource(server.url, undefined, async (es) => {
      const e = await waitForOpenEvent(es);
      expect(e.type).toEqual('open');
      expect(e.headers?.['x-ld-envid']).toEqual('12345');
    });
  });
});

it('supplies the correct origin', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = startMessageQueue(es);
      const m = await messages.take();
      expect(m.origin).toEqual(server.url);
    });
  });
});

it('does not double reconnect when the connection is closed by the server', async () => {
  await withServer(async (server) => {
    let numConnections = 0;
    server.byDefault((req, res) => {
      numConnections += 1;
      // End the first connection - only one reconnect is expected.
      if (numConnections === 1) {
        res.end();
      } else {
        writeEvents([])(req, res);
      }
    });

    await withEventSource(server.url, { initialRetryDelayMillis: 50 }, async () => {
      await server.nextRequest();
      await server.nextRequest();

      await sleepAsync(300);
      expect(server.requests.isEmpty()).toBe(true);
    });
  });
});

it('does not emit an error when the connection is closed by the client', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      const errors = startErrorQueue(es);
      await waitForOpenEvent(es);
      es.close();
      await expectNothingReceived(errors);
    });
  });
});

it('populates lastEventId when the last event has an associated id', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['id: 123\ndata: hello\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = startMessageQueue(es);
      const m = await messages.take();
      expect(m.lastEventId).toEqual('123');
    });
  });
});

it('carries lastEventId forward when a later event has no associated id', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['id: 123\ndata: Hello\n\n', 'data: World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = startMessageQueue(es);
      expect((await messages.take()).lastEventId).toEqual('123');
      expect((await messages.take()).lastEventId).toEqual('123');
    });
  });
});

it('ignores an event id that contains a null character', async () => {
  const nul = String.fromCharCode(0);
  await withServer(async (server) => {
    server.byDefault(writeEvents([`id: 12${nul}3\ndata: hello\n\n`]));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = startMessageQueue(es);
      const m = await messages.take();
      expect(m.lastEventId).toEqual('');
    });
  });
});

it('populates messages with enumerable properties so they can be inspected', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: World\n\n']));
    await withEventSource(server.url, undefined, async (es) => {
      const messages = startMessageQueue(es);
      const m = await messages.take();
      expect(Object.keys(m)).toEqual(expect.arrayContaining(['type', 'data']));
    });
  });
});

it('throws when the dispatched event type is unspecified, empty, or null', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async (es) => {
      expect(() => es.dispatchEvent({})).toThrow();
      expect(() => es.dispatchEvent({ type: undefined })).toThrow();
      expect(() => es.dispatchEvent({ type: '' })).toThrow();
      expect(() => es.dispatchEvent({ type: null as unknown as undefined })).toThrow();
    });
  });
});

it('delivers a dispatched event without a payload', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async (es) => {
      const messages = new AsyncQueue<MessageEvent | undefined>();
      es.addEventListener('greeting', (m) => messages.add(m));
      es.dispatchEvent({ type: 'greeting' });
      await messages.take();
    });
  });
});

it('delivers a dispatched event with a payload', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async (es) => {
      const messages = new AsyncQueue<{ data: string }>();
      es.addEventListener('greeting', (m) => messages.add(m));
      es.dispatchEvent({ type: 'greeting', detail: { data: 'Hello' } });
      const m = await messages.take();
      expect(m.data).toEqual('Hello');
    });
  });
});

it('allows removal of event listeners', async () => {
  await withServer(async (server) => {
    server.byDefault(
      writeEvents(['event: greeting\ndata: Hello\n\n', 'event: greeting\ndata: World\n\n']),
    );
    await withEventSource(server.url, undefined, async (es) => {
      const messages1 = new AsyncQueue<MessageEvent>();
      const messages2 = new AsyncQueue<MessageEvent>();
      function add1(m: MessageEvent) {
        messages1.add(m);
      }
      function add2(m: MessageEvent) {
        messages2.add(m);
      }
      es.addEventListener('greeting', add1);
      es.addEventListener('greeting', add2);
      es.removeEventListener('greeting', add1);

      await messages2.take();
      await expectNothingReceived(messages1);
    });
  });
});

it('returns the originally registered function from the on* accessors', async () => {
  await withServer(async (server) => {
    await withEventSource(server.url, undefined, async (es) => {
      const handler = () => {};
      es.onmessage = handler;
      expect(es.onmessage).toBe(handler);
    });
  });
});
