import * as http from 'http';

import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { ErrorEvent, MessageEvent } from '../src/types';
import { withEventSource, withServer } from './helpers';

const briefDelay = 1;

function makeStreamHandler(timeBetweenEvents: number) {
  let requestCount = 0;
  return (req: unknown, res: http.ServerResponse) => {
    requestCount += 1;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const eventPrefix = `request-${requestCount}`;
    res.write(''); // turns on chunking
    res.write(`data: ${eventPrefix}-event-1\n\n`);
    setTimeout(() => {
      if (res.writableEnded) {
        // don't try to write any more if the connection has already been closed
        return;
      }
      res.write(`data: ${eventPrefix}-event-2\n\n`);
    }, timeBetweenEvents);
  };
}

it('drops the connection if the read timeout elapses', async () => {
  const readTimeout = 50;
  const timeBetweenEvents = 100;
  await withServer(async (server) => {
    server.byDefault(makeStreamHandler(timeBetweenEvents));
    const opts = { initialRetryDelayMillis: briefDelay, readTimeoutMillis: readTimeout };
    await withEventSource(server.url, opts, async (es) => {
      const received = new AsyncQueue<MessageEvent | ErrorEvent>();
      es.onmessage = (e) => received.add(e);
      es.onerror = (e) => received.add(e as ErrorEvent);

      const m1 = (await received.take()) as MessageEvent;
      expect(m1.type).toEqual('message');
      expect(m1.data).toEqual('request-1-event-1');

      const err = (await received.take()) as ErrorEvent;
      expect(err.type).toEqual('error');
      expect(err.message).toMatch(/^Read timeout/);

      const m2 = (await received.take()) as MessageEvent;
      expect(m2.type).toEqual('message');
      expect(m2.data).toEqual('request-2-event-1');
    });
  });
});

it('does not drop the connection if the read timeout does not elapse', async () => {
  const readTimeout = 100;
  const timeBetweenEvents = 50;
  await withServer(async (server) => {
    server.byDefault(makeStreamHandler(timeBetweenEvents));
    const opts = { initialRetryDelayMillis: briefDelay, readTimeoutMillis: readTimeout };
    await withEventSource(server.url, opts, async (es) => {
      const received = new AsyncQueue<MessageEvent | ErrorEvent>();
      es.onmessage = (e) => received.add(e);
      es.onerror = (e) => received.add(e as ErrorEvent);

      const m1 = (await received.take()) as MessageEvent;
      expect(m1.data).toEqual('request-1-event-1');

      // Receiving event 2 with the same request prefix proves the connection was not dropped.
      const m2 = (await received.take()) as MessageEvent;
      expect(m2.data).toEqual('request-1-event-2');
    });
  });
});
