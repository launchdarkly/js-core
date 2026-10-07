import { AsyncQueue, sleepAsync, TestHttpHandlers } from 'launchdarkly-js-test-helpers';

import { createAfterHealthyFor, createRetryState } from '@launchdarkly/js-sdk-common';

import { CLOSED, createEventSource, EventSource } from '../src/EventSource';
import { RetryDelayStrategy } from '../src/types';
import {
  shouldReceiveMessages,
  startMessageQueue,
  withEventSource,
  withServer,
  withSlotRethrowSwallowed,
  writeEvents,
} from './helpers';

interface RecordingStrategy extends RetryDelayStrategy {
  nextRetryDelayCalls: number[];
  goodSinceCalls: number[];
  baseDelayCalls: number[];
}

function stubStrategy(fixedDelay: number): RecordingStrategy {
  const strategy: RecordingStrategy = {
    nextRetryDelayCalls: [],
    goodSinceCalls: [],
    baseDelayCalls: [],
    nextRetryDelay(currentTimeMillis: number): number {
      strategy.nextRetryDelayCalls.push(currentTimeMillis);
      return fixedDelay;
    },
    setGoodSince(goodSinceTimeMillis: number): void {
      strategy.goodSinceCalls.push(goodSinceTimeMillis);
    },
    setBaseDelay(delayMillis: number): void {
      strategy.baseDelayCalls.push(delayMillis);
    },
  };
  return strategy;
}

it('uses an injected strategy for reconnect delays in place of the built-in behavior', async () => {
  const strategy = stubStrategy(7);
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(500));
    await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
      const delays = new AsyncQueue<number>();
      es.onretrying = (event) => delays.add(event.delayMillis);
      expect(await delays.take()).toEqual(7);
      expect(await delays.take()).toEqual(7);
      expect(strategy.nextRetryDelayCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

it('ignores the built-in retry delay options when a strategy is provided', async () => {
  const strategy = stubStrategy(7);
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(500));
    const opts = {
      retryDelayStrategy: strategy,
      initialRetryDelayMillis: 500,
      jitterRatio: 0.5,
      maxBackoffMillis: 60000,
      retryResetIntervalMillis: 60000,
    };
    await withEventSource(server.url, opts, async (es) => {
      const delays = new AsyncQueue<number>();
      es.onretrying = (event) => delays.add(event.delayMillis);
      expect(await delays.take()).toEqual(7);
      expect(await delays.take()).toEqual(7);
    });
  });
});

it('passes the good-since time to the strategy once per connection, on the first event', async () => {
  const strategy = stubStrategy(1);
  await withServer(async (server) => {
    // The first connection sends two events before the server drops it, forcing a reconnect.
    // Taking all three messages proves setGoodSince fired once per connection, not once per
    // event.
    let connection = 0;
    server.byDefault((req, res) => {
      connection += 1;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: a\n\n');
      if (connection === 1) {
        res.write('data: b\n\n');
      }
      setTimeout(() => res.destroy(), 50);
    });
    await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
      const messages = startMessageQueue(es);
      await messages.take();
      await messages.take();
      await messages.take();
      expect(strategy.goodSinceCalls).toHaveLength(2);
    });
  });
});

it('passes a valid retry: value to setBaseDelay', async () => {
  const strategy = stubStrategy(1);
  await withServer(async (server) => {
    server.byDefault(writeEvents(['retry: 3000\ndata: x\n\n']));
    await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'x' }]);
      expect(strategy.baseDelayCalls).toEqual([3000]);
    });
  });
});

it('does not pass a retry: value that is not all ASCII digits to setBaseDelay', async () => {
  const strategy = stubStrategy(1);
  await withServer(async (server) => {
    server.byDefault(writeEvents(['retry: -5000\nretry: 12abc\nretry: 1e3\ndata: x\n\n']));
    await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'x' }]);
      expect(strategy.baseDelayCalls).toEqual([]);
    });
  });
});

it('caps a retry: value at one hour before it reaches setBaseDelay', async () => {
  const strategy = stubStrategy(1);
  await withServer(async (server) => {
    server.byDefault(writeEvents(['retry: 7200000\ndata: x\n\n']));
    await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
      await shouldReceiveMessages(es, [{ data: 'x' }]);
      expect(strategy.baseDelayCalls).toEqual([3600000]);
    });
  });
});

it('keeps reconnecting when nextRetryDelay throws', async () => {
  const thrown = new Error('nextRetryDelay boom');
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => {
      throw thrown;
    },
    setGoodSince: () => {},
    setBaseDelay: () => {},
  };
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
        const delays = new AsyncQueue<number>();
        es.onretrying = (event) => delays.add(event.delayMillis);
        expect(await delays.take()).toEqual(1000);
        expect(await delays.take()).toEqual(1000);
      });
    });
  });
  expect(swallowed.length).toBeGreaterThanOrEqual(2);
  swallowed.forEach((err) => expect(err).toBe(thrown));
});

it('replaces an invalid caller-written reconnectInterval when the strategy throws', async () => {
  const thrown = new Error('nextRetryDelay boom');
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => {
      throw thrown;
    },
    setGoodSince: () => {},
    setBaseDelay: () => {},
  };
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
        // The slot is caller-writable, so a junk write must not reach setTimeout as the
        // fallback delay.
        es.reconnectInterval = 'not-a-number' as unknown as number;
        const delays = new AsyncQueue<number>();
        es.onretrying = (event) => delays.add(event.delayMillis);
        expect(await delays.take()).toEqual(1000);
      });
    });
  });
  expect(swallowed.length).toBeGreaterThanOrEqual(1);
});

it('caps and floors the fallback delay when the strategy throws', async () => {
  const thrown = new Error('nextRetryDelay boom');
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => {
      throw thrown;
    },
    setGoodSince: () => {},
    setBaseDelay: () => {},
  };
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
        const delays = new AsyncQueue<number>();
        es.onretrying = (event) => delays.add(event.delayMillis);
        // A negative write falls back to the default initial delay.
        es.reconnectInterval = -5;
        expect(await delays.take()).toEqual(1000);
        // An oversized write is capped at one hour, like a server-directed value.
        es.reconnectInterval = 7200000;
        expect(await delays.take()).toEqual(3600000);
      });
    });
  });
  expect(swallowed.length).toBeGreaterThanOrEqual(2);
}, 10000);

it('keeps the stream alive when setBaseDelay throws', async () => {
  const thrown = new Error('setBaseDelay boom');
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => 1,
    setGoodSince: () => {},
    setBaseDelay: () => {
      throw thrown;
    },
  };
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(writeEvents(['retry: 3000\ndata: x\n\n']));
      await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
        await shouldReceiveMessages(es, [{ data: 'x' }]);
        expect(es.reconnectInterval).toEqual(3000);
      });
    });
  });
  expect(swallowed).toEqual([thrown]);
});

it('does not dispatch the triggering message when setGoodSince calls close()', async () => {
  let es: EventSource;
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => 1,
    setGoodSince: () => {
      es.close();
    },
    setBaseDelay: () => {},
  };
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: x\n\n']));
    es = createEventSource(server.url, { retryDelayStrategy: strategy });
    es.onerror = () => {};
    const messages = startMessageQueue(es);
    await sleepAsync(100);
    expect(messages.isEmpty()).toBe(true);
    expect(es.readyState).toEqual(CLOSED);
  });
});

it('passes the strategy timestamps from the monotonic clock, not the wall clock', async () => {
  // A large fixed delay keeps the reconnect from firing during the test, so the strategy
  // records exactly one retry reading. A wall-clock reading would be an epoch value; the
  // mocked monotonic readings below prove performance.now() is the source.
  const strategy = stubStrategy(60000);
  let fakeNow = 10000;
  const nowSpy = jest.spyOn(globalThis.performance, 'now').mockImplementation(() => fakeNow);
  try {
    await withServer(async (server) => {
      // One event anchors the good-since time, then the server drops the connection, which asks
      // the strategy for a retry delay.
      server.byDefault((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: a\n\n');
        setTimeout(() => res.destroy(), 20);
      });
      await withEventSource(server.url, { retryDelayStrategy: strategy }, async (es) => {
        const messages = startMessageQueue(es);
        await messages.take();
        fakeNow = 10500;
        for (let i = 0; i < 500 && strategy.nextRetryDelayCalls.length === 0; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await sleepAsync(10);
        }
        expect(strategy.goodSinceCalls).toEqual([10000]);
        expect(strategy.nextRetryDelayCalls).toEqual([10500]);
      });
    });
  } finally {
    nowSpy.mockRestore();
  }
}, 10000);

it('drives reconnect delays from a js-sdk-common RetryState adapted the way an SDK does', async () => {
  // The three-method adapter below is the exact shape the SDK data sources use to wire the
  // common RetryState into this package. The data source records outcomes from its own error
  // handling; the errorFilter stands in for that here.
  const retryState = createRetryState({
    normalInitialDelayMs: 5,
    normalCeilingMs: 100,
    extendedInitialDelayMs: 50,
    extendedCeilingMs: 100,
    resetPolicy: createAfterHealthyFor(60000),
    random: () => 0,
  });
  const strategy: RetryDelayStrategy = {
    nextRetryDelay: () => retryState.nextDelay,
    setGoodSince: () => retryState.recordSuccess(),
    setBaseDelay: (delayMillis) => retryState.applyServerDirectedRetry(delayMillis),
  };
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(500));
    const opts = {
      retryDelayStrategy: strategy,
      errorFilter: () => {
        retryState.recordFailure('normal');
        return true;
      },
    };
    await withEventSource(server.url, opts, async (es) => {
      const delays = new AsyncQueue<number>();
      es.onretrying = (event) => delays.add(event.delayMillis);
      // With zero jitter the delay doubles from the initial 5ms: 5, then 10.
      expect(await delays.take()).toEqual(5);
      expect(await delays.take()).toEqual(10);
    });
  });
});
