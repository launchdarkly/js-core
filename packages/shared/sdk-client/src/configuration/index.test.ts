import Configuration from './';

describe('Configuration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    console.error = jest.fn();
  });

  test('defaults', () => {
    const config = new Configuration();

    expect(config).toMatchObject({
      allAttributesPrivate: false,
      baseUri: 'https://sdk.launchdarkly.com',
      capacity: 100,
      diagnosticOptOut: false,
      diagnosticRecordingInterval: 900000,
      evaluationReasons: false,
      eventsUri: 'https://events.launchdarkly.com',
      flushInterval: 2000,
      inspectors: [],
      logger: {
        destination: console.error,
        logLevel: 1,
        name: 'LaunchDarkly',
      },
      privateAttributes: [],
      sendEvents: true,
      sendEventsOnlyForVariation: false,
      sendLDHeaders: true,
      streamReconnectDelay: 1000,
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
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unknown config option'));
  });

  test('wrong type for boolean', () => {
    // @ts-ignore
    const config = new Configuration({ stream: 1 });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be of type boolean | undefined | null, got number'),
    );
    expect(config.stream).toBeUndefined();
  });

  test('wrong type for number', () => {
    // @ts-ignore
    const config = new Configuration({ capacity: true });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('should be of type number with minimum value of 1, got boolean'),
    );
    expect(config.capacity).toEqual(100);
  });

  test('enforce minimum', () => {
    const config = new Configuration({ flushInterval: 1 });

    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        '"flushInterval" had invalid value of 1, using minimum of 2000 instead',
      ),
    );
    expect(config.flushInterval).toEqual(2000);
  });

  // test('TODO: nullable stream should not log warning', () => {
  //   const config = new Configuration({ stream: undefined });
  //   expect(console.error).not.toHaveBeenCalled();
  // });
  //
  // test('TODO: test bootstrap', () => {
  //   const config = new Configuration({ bootstrap: 'localStorage' });
  //   expect(console.error).not.toHaveBeenCalled();
  // });
});
