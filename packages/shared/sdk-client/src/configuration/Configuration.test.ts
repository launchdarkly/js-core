/* eslint-disable no-console */
import Configuration from './Configuration';

describe('Configuration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    console.error = jest.fn();
  });

  test('defaults', () => {
    const config = new Configuration();

    expect(config).toMatchObject({
      allAttributesPrivate: false,
      baseUri: 'https://clientsdk.launchdarkly.com',
      capacity: 100,
      diagnosticOptOut: false,
      diagnosticRecordingInterval: 900,
      evaluationReasons: false,
      eventsUri: 'https://events.launchdarkly.com',
      flushInterval: 2,
      inspectors: [],
      logger: {
        destination: console.error,
        logLevel: 1,
        name: 'LaunchDarkly',
      },
      privateAttributes: [],
      sendEvents: true,
      sendLDHeaders: true,
      streamInitialReconnectDelay: 1,
      streamUri: 'https://clientstream.launchdarkly.com',
      useReport: false,
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  test('specified options should be set', () => {
    const config = new Configuration({ wrapperName: 'test', stream: true });
    expect(config).toMatchObject({ wrapperName: 'test', stream: true });
  });

  test('unknown option', () => {
    // @ts-ignore
    const config = new Configuration({ baseballUri: 1 });

    expect(config.baseballUri).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unknown config option'));
  });

  test('wrong type for boolean should be converted', () => {
    // @ts-ignore
    const config = new Configuration({ sendEvents: 0 });

    expect(config.stream).toBeFalsy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be a boolean, got number, converting'),
    );
  });

  test('wrong type for number should use default', () => {
    // @ts-ignore
    const config = new Configuration({ capacity: true });

    expect(config.capacity).toEqual(100);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be of type number with minimum value of 1, got boolean'),
    );
  });

  test('enforce minimum', () => {
    const config = new Configuration({ flushInterval: 1 });

    expect(config.flushInterval).toEqual(2);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"flushInterval" had invalid value of 1, using minimum of 2 instead'),
    );
  });

  test('undefined stream should not log warning', () => {
    const config = new Configuration({ stream: undefined });

    expect(config.stream).toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('null stream should default to undefined', () => {
    // @ts-ignore
    const config = new Configuration({ stream: null });

    expect(config.stream).toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('wrong stream type should be converted to boolean', () => {
    // @ts-ignore
    const config = new Configuration({ stream: 1 });

    expect(config.stream).toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });

  test('invalid bootstrap should use default', () => {
    // @ts-ignore
    const config = new Configuration({ bootstrap: 'localStora' });

    expect(config.bootstrap).toBeUndefined();
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`should be of type 'localStorage' | LDFlagSet, got string`),
    );
  });
});
