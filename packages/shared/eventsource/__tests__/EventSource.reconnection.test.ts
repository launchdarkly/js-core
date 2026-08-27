import { AsyncQueue, TestHttpHandlers, TestHttpRequest, withCloseable } from 'launchdarkly-js-test-helpers';

import EventSource from '../src/EventSource';
import { EventSourceInitDict } from '../src/types';
import {
  expectInRange,
  expectNothingReceived,
  initiallyDownServerPort,
  shouldReceiveMessages,
  startErrorQueue,
  startMessageQueue,
  withEventSource,
  withServer,
  withServerOnPort,
  writeEvents,
} from './helpers';

const briefDelay = 1;
const delayOpts: EventSourceInitDict = { initialRetryDelayMillis: briefDelay };

async function shouldReconnectAndGetMessage(
  port: number,
  es: EventSource,
): Promise<TestHttpRequest> {
  let request: TestHttpRequest | undefined;
  await withServerOnPort(port, async (server) => {
    server.byDefault(writeEvents(['data: got it\n\n']));
    await shouldReceiveMessages(es, [{ data: 'got it' }]);
    request = await server.nextRequest();
  });
  return request as TestHttpRequest;
}

async function shouldNotReconnect(port: number, es: EventSource): Promise<void> {
  await withServerOnPort(port, async (server) => {
    server.byDefault(writeEvents(['data: got it\n\n']));
    const messages = startMessageQueue(es);
    await expectNothingReceived(messages);
  });
}

it('reconnects when the server is down', async () => {
  await withCloseable(
    new EventSource(`http://localhost:${initiallyDownServerPort}`, delayOpts),
    async (es) => {
      const errors = startErrorQueue(es);
      await errors.take();
      await shouldReconnectAndGetMessage(initiallyDownServerPort, es);
    },
  );
});

it('reconnects when the server goes down after connecting', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, delayOpts, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
      await server.closeAndWait();
      await shouldReconnectAndGetMessage(server.port, es);
    });
  });
});

it('reconnects when the server responds with a 500', async () => {
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(500));
    await withEventSource(server.url, delayOpts, async (es) => {
      const errors = startErrorQueue(es);
      await errors.take();
      await server.closeAndWait();
      await shouldReconnectAndGetMessage(server.port, es);
    });
  });
});

it('stops reconnecting when the event source is closed', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, delayOpts, async (es) => {
      const errors = startErrorQueue(es);
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
      await server.closeAndWait();
      await errors.take();

      // We received an error because the remote connection was closed. We close es, so we do not
      // want es to reconnect.
      es.close();

      await shouldNotReconnect(server.port, es);
    });
  });
});

it('does not reconnect when the server responds with a non-200, non-500 status', async () => {
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(204));
    await withEventSource(server.url, delayOpts, async (es) => {
      const errors = startErrorQueue(es);
      await errors.take();
      await server.closeAndWait();
      await shouldNotReconnect(server.port, es);
    });
  });
});

it('reconnects for a non-200, non-500 status if errorFilter says so', async () => {
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(204));
    const opts = { ...delayOpts, errorFilter: (err: { status?: number }) => err.status === 204 };
    await withEventSource(server.url, opts, async (es) => {
      const errors = startErrorQueue(es);
      await errors.take();
      await server.closeAndWait();
      await shouldReconnectAndGetMessage(server.port, es);
    });
  });
});

it('sends the Last-Event-ID header when the server previously sent an event id', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['id: 10\ndata: Hello\n\n']));
    await withEventSource(server.url, delayOpts, async (es) => {
      const messages = startMessageQueue(es);
      await messages.take();
      await server.closeAndWait();
      const req = await shouldReconnectAndGetMessage(server.port, es);
      expect(req.headers['last-event-id']).toEqual('10');
    });
  });
});

it('does not send the Last-Event-ID header when the server never sent an event id', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, delayOpts, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'hello' }]);
      await server.closeAndWait();
      const req = await shouldReconnectAndGetMessage(server.port, es);
      expect(req.headers['last-event-id']).toBeUndefined();
    });
  });
});

async function verifyDelays(
  options: EventSourceInitDict,
  count: number,
  assertion: (delays: number[]) => void,
): Promise<void> {
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(500));
    await withEventSource(server.url, options, async (es) => {
      const delays = new AsyncQueue<number>();
      es.onretrying = (event) => delays.add(event.delayMillis);
      const allDelays: number[] = [];
      while (allDelays.length < count) {
        // eslint-disable-next-line no-await-in-loop
        allDelays.push(await delays.take());
      }
      assertion(allDelays);
    });
  });
}

it('uses a constant retry delay by default', async () => {
  const delay = 5;
  await verifyDelays({ initialRetryDelayMillis: delay }, 3, (delays) => {
    expect(delays).toEqual([delay, delay, delay]);
  });
});

it('can use backoff with a maximum', async () => {
  const delay = 5;
  const max = 31;
  await verifyDelays({ initialRetryDelayMillis: delay, maxBackoffMillis: max }, 4, (delays) => {
    expect(delays).toEqual([delay, delay * 2, delay * 4, max]);
  });
});

it('can use backoff with jitter', async () => {
  const delay = 5;
  const max = 31;
  await verifyDelays(
    { initialRetryDelayMillis: delay, maxBackoffMillis: max, jitterRatio: 0.5 },
    3,
    (delays) => {
      expect(delays.length).toEqual(3);
      expectInRange(delays[0], delay / 2, delay);
      expectInRange(delays[1], delay, delay * 2);
      expectInRange(delays[2], delay * 2, delay * 4);
    },
  );
});
