import { type EventName, LDLogger } from '@launchdarkly/js-client-sdk-common';

import EventSource, {
  backoff,
  jitter,
} from '../../../src/fromExternal/react-native-sse/EventSource';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

describe('EventSource', () => {
  const uri = 'https://mock.events.uri';
  let eventSource: EventSource<EventName>;
  let mockXhr: any;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest
      .spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.888)
      .mockImplementationOnce(() => 0.999);

    mockXhr = {
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      abort: jest.fn(),
    };

    const xhrSpy = jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => mockXhr as XMLHttpRequest);
    // Preserve static constants that EventSource reads from the constructor reference.
    // @ts-ignore
    xhrSpy.LOADING = 3;
    // @ts-ignore
    xhrSpy.DONE = 4;

    eventSource = new EventSource<EventName>(uri, { logger });
    eventSource.onclose = jest.fn();
    eventSource.onretrying = jest.fn();
  });

  afterEach(() => {
    // GOTCHA: Math.random must be reset separately because of a source-map type error
    // https://medium.com/orchestrated/updating-react-to-version-17-471bfbe6bfcd
    jest.spyOn(Math, 'random').mockRestore();

    jest.resetAllMocks();
  });

  test('backoff exponentially', () => {
    const delay0 = backoff(1000, 0);
    const delay1 = backoff(1000, 1);
    const delay2 = backoff(1000, 2);

    expect(delay0).toEqual(1000);
    expect(delay1).toEqual(2000);
    expect(delay2).toEqual(4000);
  });

  test('backoff returns max delay', () => {
    const delay = backoff(1000, 5);
    expect(delay).toEqual(30000);
  });

  test('jitter', () => {
    const delay0 = jitter(1000);
    const delay1 = jitter(2000);

    expect(delay0).toEqual(556);
    expect(delay1).toEqual(1001);
  });

  test('getNextRetryDelay', () => {
    // @ts-ignore
    const delay0 = eventSource._getNextRetryDelay();
    // @ts-ignore
    const delay1 = eventSource._getNextRetryDelay();

    // @ts-ignore
    expect(eventSource._retryCount).toEqual(2);
    expect(delay0).toEqual(556);
    expect(delay1).toEqual(1001);
  });

  test('initial connection', () => {
    jest.runAllTimers();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/\[EventSource\] opening new connection./),
    );
    expect(mockXhr.open).toHaveBeenCalledTimes(1);
    expect(eventSource.onclose).toHaveBeenCalledTimes(0);
  });

  test('tryConnect with delay', () => {
    jest.runAllTimers();
    // This forces it to reconnect.
    // @ts-ignore
    eventSource._tryConnect();
    jest.runAllTimers();

    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/new connection in 556 ms/i),
    );
    expect(eventSource.onretrying).toHaveBeenCalledWith({ type: 'retry', delayMillis: 556 });
    // Initial connection + forced reconnect.
    expect(mockXhr.open).toHaveBeenCalledTimes(2);
    expect(eventSource.onclose).toHaveBeenCalledTimes(1);
  });

  test('recomputes the connection URL via urlBuilder on each connection', () => {
    let basis: string | undefined;
    const urlBuilder = jest.fn(() => (basis ? `${uri}?basis=${basis}` : uri));
    const es = new EventSource<EventName>(uri, { logger, urlBuilder });
    es.onretrying = jest.fn();

    // Initial connection asks the builder for the URL (no selector known yet).
    jest.runAllTimers();
    expect(urlBuilder).toHaveBeenCalled();
    expect(mockXhr.open).toHaveBeenLastCalledWith('GET', uri, true);

    // Once a selector is known, a reconnect must replay it (e.g. FDv2 basis)
    // rather than reuse the original URL.
    basis = 'initial';
    // @ts-ignore - force a reconnect
    es._tryConnect();
    jest.runAllTimers();

    expect(mockXhr.open).toHaveBeenLastCalledWith('GET', `${uri}?basis=initial`, true);
  });

  test('calls onopen with parsed response headers', () => {
    const onopen = jest.fn();
    eventSource.onopen = onopen;

    mockXhr.getAllResponseHeaders = jest.fn(
      () => 'X-Ld-Fd-Fallback: true\r\nX-Ld-Fd-Fallback-Ttl: 60\r\nContent-Type: text/event-stream',
    );
    mockXhr.responseText = '';

    jest.runAllTimers();

    mockXhr.readyState = 4;
    mockXhr.status = 200;
    mockXhr.onreadystatechange();

    expect(onopen).toHaveBeenCalledTimes(1);
    expect(onopen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open',
        headers: expect.objectContaining({
          'x-ld-fd-fallback': 'true',
          'x-ld-fd-fallback-ttl': '60',
        }),
      }),
    );
  });

  test('calls onopen with parsed response headers during streaming (onprogress, pre-DONE)', () => {
    const onopen = jest.fn();
    eventSource.onopen = onopen;

    mockXhr.getAllResponseHeaders = jest.fn(
      () => 'X-Ld-Fd-Fallback: true\r\nX-Ld-Fd-Fallback-Ttl: 60\r\nContent-Type: text/event-stream',
    );
    mockXhr.responseText = '';

    jest.runAllTimers();

    // Simulate a chunk arriving while the connection is still LOADING (readyState 3).
    // This is the real runtime path for a live stream: DONE (readyState 4) only
    // fires once the connection closes, so gating 'open' on DONE would mean the
    // event, and the fallback headers it carries, never fires during normal streaming.
    mockXhr.readyState = 3;
    mockXhr.status = 200;
    mockXhr.onprogress();

    expect(onopen).toHaveBeenCalledTimes(1);
    expect(onopen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open',
        headers: expect.objectContaining({
          'x-ld-fd-fallback': 'true',
          'x-ld-fd-fallback-ttl': '60',
        }),
      }),
    );
  });

  test('dispatches open exactly once when onprogress precedes an onreadystatechange DONE', () => {
    const onopen = jest.fn();
    eventSource.onopen = onopen;

    mockXhr.getAllResponseHeaders = jest.fn(
      () => 'X-Ld-Fd-Fallback: true\r\nX-Ld-Fd-Fallback-Ttl: 60\r\nContent-Type: text/event-stream',
    );
    mockXhr.responseText = '';

    jest.runAllTimers();

    // onprogress observes the connection first (LOADING) and transitions to OPEN.
    mockXhr.readyState = 3;
    mockXhr.status = 200;
    mockXhr.onprogress();

    // A later onreadystatechange at DONE must not re-dispatch open: the status is
    // already OPEN (no longer CONNECTING), so its open-dispatch guard is a no-op.
    mockXhr.readyState = 4;
    mockXhr.status = 200;
    mockXhr.onreadystatechange();

    expect(onopen).toHaveBeenCalledTimes(1);
  });
});
