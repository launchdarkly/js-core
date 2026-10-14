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

    jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => mockXhr as XMLHttpRequest);

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

  test('uses the injected retryDelayStrategy for the reconnect delay instead of the built-in backoff', () => {
    const retryDelayStrategy = {
      nextRetryDelay: jest.fn((_nowMs: number) => 300000),
      setGoodSince: jest.fn((_timeMs?: number) => {}),
      setBaseDelay: jest.fn((_baseDelayMs: number) => {}),
    };
    const es = new EventSource<EventName>(uri, { logger, retryDelayStrategy });

    // @ts-ignore - private
    const delay = es._getNextRetryDelay();

    expect(retryDelayStrategy.nextRetryDelay).toHaveBeenCalledTimes(1);
    expect(delay).toEqual(300000);
    // The built-in backoff counter is untouched when a strategy drives the delay.
    // @ts-ignore - private
    expect(es._retryCount).toEqual(0);
  });

  test('anchors the retryDelayStrategy healthy-reset on the first received event only', () => {
    const retryDelayStrategy = {
      nextRetryDelay: jest.fn((_nowMs: number) => 300000),
      setGoodSince: jest.fn((_timeMs?: number) => {}),
      setBaseDelay: jest.fn((_baseDelayMs: number) => {}),
    };
    const es = new EventSource<EventName>(uri, { logger, retryDelayStrategy });

    // Drive the SSE parser directly with a growing buffer carrying two events.
    // @ts-ignore - private
    es._handleEvent('data: a\n\n');
    // @ts-ignore - private
    es._handleEvent('data: a\n\ndata: b\n\n');

    // Only the first event anchors the healthy-reset window.
    expect(retryDelayStrategy.setGoodSince).toHaveBeenCalledTimes(1);
  });

  test('reports a clean server close through the error filter before reconnecting', () => {
    // The transport reads XMLHttpRequest.DONE off the (mocked) global.
    (window.XMLHttpRequest as any).DONE = 4;

    const retryAndHandleError = jest.fn(() => true);
    const es = new EventSource<EventName>(uri, { logger, retryAndHandleError });
    es.onretrying = jest.fn();

    // Open the connection so the readystatechange handler is wired up.
    jest.runAllTimers();

    // Server cleanly closes the stream: a 2xx response reaching readyState DONE.
    mockXhr.status = 200;
    mockXhr.readyState = 4;
    mockXhr.onreadystatechange();

    // The clean close is reported with no status, so the strategy classifies it
    // as a `normal` failure and backs off rather than reconnecting on the stale
    // (post-success) delay.
    expect(retryAndHandleError).toHaveBeenCalledTimes(1);
    expect(retryAndHandleError).toHaveBeenCalledWith({ message: 'stream closed by server' });

    // The filter allowed a retry, so a reconnect is scheduled — a clean close
    // never permanently stops the stream.
    expect(es.onretrying).toHaveBeenCalled();
  });

  test('retries after a 401 instead of permanently stopping', () => {
    (window.XMLHttpRequest as any).DONE = 4;

    const retryAndHandleError = jest.fn(() => true);
    const es = new EventSource<EventName>(uri, { logger, retryAndHandleError });
    es.onretrying = jest.fn();

    // Open the connection so the readystatechange handler is wired up.
    jest.runAllTimers();

    // Server responds 401 and completes.
    mockXhr.status = 401;
    mockXhr.readyState = 4;
    mockXhr.onreadystatechange();

    // The status-bearing failure is routed to the error filter, which decides
    // whether to retry. The SDK's filter always retries, so the stream never
    // permanently stops on a 401.
    expect(retryAndHandleError).toHaveBeenCalledTimes(1);
    expect(retryAndHandleError).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));

    // A reconnect is scheduled rather than the stream permanently stopping.
    expect(es.onretrying).toHaveBeenCalled();
  });
});
