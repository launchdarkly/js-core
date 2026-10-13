import { EventSourceRetryDelayStrategy } from '@launchdarkly/js-client-sdk-common';

import DefaultBrowserEventSource from '../../src/platform/DefaultBrowserEventSource';

/**
 * Minimal stand-in for the browser's native EventSource. Each construction is
 * recorded so a test can assert how many (re)connections were attempted, and
 * the handlers the SUT installs can be fired directly.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  public onopen: ((e?: any) => void) | null = null;

  public onerror: ((e?: any) => void) | null = null;

  public readonly listeners: Record<string, Array<(e: any) => void>> = {};

  public closed = false;

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  close() {
    this.closed = true;
  }
}

const originalEventSource = (globalThis as any).EventSource;

function makeStrategy(nextDelay: number) {
  return {
    nextRetryDelay: jest.fn((_nowMs: number) => nextDelay),
    setGoodSince: jest.fn((_timeMs?: number) => {}),
    setBaseDelay: jest.fn((_baseDelayMs: number) => {}),
  };
}

function makeEventSource(
  overrides: {
    errorFilter?: (err: any) => boolean;
    retryDelayStrategy?: EventSourceRetryDelayStrategy;
  } = {},
) {
  return new DefaultBrowserEventSource('https://stream.example/eval', {
    errorFilter: overrides.errorFilter ?? (() => true),
    initialRetryDelayMillis: 1000,
    retryResetIntervalMillis: 60 * 1000,
    readTimeoutMillis: 5 * 60 * 1000,
    retryDelayStrategy: overrides.retryDelayStrategy,
  } as any);
}

function statusError(status: number) {
  return Object.assign(new Event('error'), { status });
}

describe('given a DefaultBrowserEventSource', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as any).EventSource = FakeEventSource as any;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    (globalThis as any).EventSource = originalEventSource;
  });

  it('reconnects on a statusless (native) error without consulting the error filter', () => {
    const errorFilter = jest.fn(() => true);
    makeEventSource({ errorFilter });

    const first = FakeEventSource.instances[0];
    first.onerror?.(new Event('error')); // native errors carry no status

    // The native transport cannot classify, so the filter must not run.
    expect(errorFilter).not.toHaveBeenCalled();
    expect(first.closed).toBe(true);

    // It still reconnects (never permanently stops).
    jest.advanceTimersByTime(60 * 1000);
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('stops when a status is present and the error filter rejects it', () => {
    const errorFilter = jest.fn(() => false);
    makeEventSource({ errorFilter });

    const first = FakeEventSource.instances[0];
    first.onerror?.(statusError(401));

    expect(errorFilter).toHaveBeenCalledTimes(1);

    // A rejecting filter is terminal: no reconnection, ever.
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('reconnects on the injected strategy delay when a status is present and the filter accepts', () => {
    const errorFilter = jest.fn(() => true);
    const retryDelayStrategy = makeStrategy(5 * 60 * 1000); // extended-regime delay
    const es = makeEventSource({ errorFilter, retryDelayStrategy });

    let retryingDelay: number | undefined;
    es.onretrying = (e) => {
      retryingDelay = e.delayMillis;
    };

    const first = FakeEventSource.instances[0];
    first.onerror?.(statusError(401));

    // The filter advanced the strategy; the strategy drove the delay.
    expect(errorFilter).toHaveBeenCalledTimes(1);
    expect(retryDelayStrategy.nextRetryDelay).toHaveBeenCalledTimes(1);
    expect(retryingDelay).toBe(5 * 60 * 1000);

    // It does not reconnect before the strategy's delay elapses...
    jest.advanceTimersByTime(5 * 60 * 1000 - 1000);
    expect(FakeEventSource.instances).toHaveLength(1);
    // ...and does once it does.
    jest.advanceTimersByTime(2000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('uses the built-in backoff (not the strategy) for a statusless error even when a strategy is injected', () => {
    const retryDelayStrategy = makeStrategy(5 * 60 * 1000);
    makeEventSource({ retryDelayStrategy });

    const first = FakeEventSource.instances[0];
    first.onerror?.(new Event('error')); // no status

    // The strategy is not advanced by a statusless error, so it must not be
    // consulted for the delay (otherwise native would never back off).
    expect(retryDelayStrategy.nextRetryDelay).not.toHaveBeenCalled();

    // It reconnects on the built-in backoff's sub-minute schedule, not the
    // strategy's 5-minute delay.
    jest.advanceTimersByTime(60 * 1000);
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the built-in backoff when a status is present but no strategy was injected', () => {
    const es = makeEventSource({ errorFilter: () => true });

    let retryingDelay: number | undefined;
    es.onretrying = (e) => {
      retryingDelay = e.delayMillis;
    };

    const first = FakeEventSource.instances[0];
    first.onerror?.(statusError(503));

    // No strategy => a finite built-in backoff delay drives the reconnect.
    expect(retryingDelay).toBeGreaterThan(0);
    jest.advanceTimersByTime(60 * 1000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('anchors the retry-delay strategy healthy-reset on the first received event, not on open', () => {
    const retryDelayStrategy = makeStrategy(1000);
    const es = makeEventSource({ retryDelayStrategy });
    es.addEventListener('put' as any, () => {});

    const fake = FakeEventSource.instances[0];

    // Opening the connection alone must not anchor the healthy-reset clock: a
    // connection that opens but delivers no data is not yet "healthy".
    fake.onopen?.();
    expect(retryDelayStrategy.setGoodSince).not.toHaveBeenCalled();

    // The first received event anchors it exactly once...
    fake.listeners.put[0]({ data: '{}' });
    expect(retryDelayStrategy.setGoodSince).toHaveBeenCalledTimes(1);

    // ...and later events on the same connection do not re-anchor.
    fake.listeners.put[0]({ data: '{}' });
    expect(retryDelayStrategy.setGoodSince).toHaveBeenCalledTimes(1);
  });
});
