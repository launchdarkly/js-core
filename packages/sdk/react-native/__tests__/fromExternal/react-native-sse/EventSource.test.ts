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
});
