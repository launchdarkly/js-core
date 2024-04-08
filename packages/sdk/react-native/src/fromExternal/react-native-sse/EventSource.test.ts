import { type EventName } from '@launchdarkly/js-client-sdk-common';
import { logger } from '@launchdarkly/private-js-mocks';

import EventSource, { backoff, jitter } from './EventSource';

const createXhrMock = () => {
  const xhrMock = {
    abort: jest.fn(),
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    readyState: 4,
    status: 200,
    response: 'Hello World!',
    onreadystatechange: jest.fn(),
  };
  jest
    .spyOn(window, 'XMLHttpRequest')
    .mockImplementation(() => xhrMock as unknown as XMLHttpRequest);
  Object.defineProperties(window.XMLHttpRequest, {
    DONE: { value: 4 },
    LOADING: { value: 3 },
    HEADERS_RECEIVED: { value: 2 },
    OPENED: { value: 1 },
    UNSENT: { value: 0 },
  });

  return xhrMock;
};

describe('EventSource', () => {
  const uri = 'https://mock.events.uri';
  let eventSource: EventSource<EventName>;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest
      .spyOn(Math, 'random')
      .mockImplementationOnce(() => 0.888)
      .mockImplementationOnce(() => 0.999);

    eventSource = new EventSource<EventName>(uri, { logger });
    eventSource.onclose = jest.fn();
    eventSource.open = jest.fn();
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
    const delay0 = eventSource.getNextRetryDelay();
    // @ts-ignore
    const delay1 = eventSource.getNextRetryDelay();

    // @ts-ignore
    expect(eventSource.retryCount).toEqual(2);
    expect(delay0).toEqual(556);
    expect(delay1).toEqual(1001);
  });

  test('tryConnect force no delay', () => {
    // @ts-ignore
    eventSource.tryConnect(true);
    jest.runAllTimers();

    expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/new connection in 0 ms/i));
    expect(eventSource.onretrying).toHaveBeenCalledWith({ type: 'retry', delayMillis: 0 });
    expect(eventSource.open).toHaveBeenCalledTimes(1);
    expect(eventSource.onclose).toHaveBeenCalledTimes(1);
  });

  test('tryConnect with delay', () => {
    // @ts-ignore
    eventSource.tryConnect();
    jest.runAllTimers();

    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/new connection in 556 ms/i),
    );
    expect(eventSource.onretrying).toHaveBeenCalledWith({ type: 'retry', delayMillis: 556 });
    expect(eventSource.open).toHaveBeenCalledTimes(1);
    expect(eventSource.onclose).toHaveBeenCalledTimes(1);
  });

  test.only('reset retry count', () => {
    const mockXhr = createXhrMock();

    // @ts-ignore
    jest.spyOn(EventSource.prototype, 'resetRetryCount');
    jest.spyOn(EventSource.prototype, 'open');
    eventSource = new EventSource<EventName>(uri, { logger });

    const es = eventSource as any;
    es.retryCount = 5; // arbitrary start

    // trigger the initial open()
    jest.runAllTimers();

    // simulate xhr state change
    mockXhr.onreadystatechange(null);

    // advance by 20 seconds to trigger another open()
    jest.advanceTimersByTime(20000);

    // simulate another state change
    mockXhr.onreadystatechange(null);

    expect(es.open).toHaveBeenCalledTimes(2);
    expect(es.resetRetryCount).toHaveBeenCalledTimes(2);
    expect(es.retryCount).toEqual(7);

    jest.runAllTimers();
    expect(es.retryCount).toEqual(0);
  });
});
