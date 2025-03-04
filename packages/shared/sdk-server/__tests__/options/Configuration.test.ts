import { LDOptions } from '../../src';
import Configuration from '../../src/options/Configuration';
import TestLogger, { LogLevel } from '../Logger';

function withLogger(options: LDOptions): LDOptions {
  return { ...options, logger: new TestLogger() };
}

function logger(options: LDOptions): TestLogger {
  return options.logger as TestLogger;
}

describe.each([undefined, null, 'potat0', 17, [], {}])('constructed without options', (input) => {
  it('should have default options', () => {
    // JavaScript is not going to stop you from calling this with whatever
    // you want. So we need to tell TS to ingore our bad behavior.
    // @ts-ignore
    const config = new Configuration(input);

    expect(config.allAttributesPrivate).toBe(false);
    expect(config.contextKeysCapacity).toBe(1000);
    expect(config.contextKeysFlushInterval).toBe(300);
    expect(config.diagnosticOptOut).toBe(false);
    expect(config.eventsCapacity).toBe(10000);
    expect(config.flushInterval).toBe(5);
    expect(config.logger).toBeUndefined();
    expect(config.offline).toBe(false);
    expect(config.pollInterval).toBe(30);
    expect(config.privateAttributes).toStrictEqual([]);
    expect(config.proxyOptions).toBeUndefined();
    expect(config.sendEvents).toBe(true);
    expect(config.serviceEndpoints.streaming).toEqual('https://stream.launchdarkly.com');
    expect(config.serviceEndpoints.polling).toEqual('https://sdk.launchdarkly.com');
    expect(config.serviceEndpoints.events).toEqual('https://events.launchdarkly.com');
    expect(config.stream).toBe(true);
    expect(config.streamInitialReconnectDelay).toEqual(1);
    expect(config.tags.value).toBeUndefined();
    expect(config.timeout).toEqual(5);
    expect(config.tlsParams).toBeUndefined();
    expect(config.useLdd).toBe(false);
    expect(config.wrapperName).toBeUndefined();
    expect(config.wrapperVersion).toBeUndefined();
    expect(config.hooks).toBeUndefined();
    expect(config.payloadFilterKey).toBeUndefined();
  });
});

describe('when setting different options', () => {
  it.each([
    [
      'http://cats.launchdarkly.com',
      'http://cats.launchdarkly.com',
      [
        { level: LogLevel.Warn, matches: /You have set custom uris without.* streamUri/ },
        { level: LogLevel.Warn, matches: /You have set custom uris without.* eventsUri/ },
      ],
    ],
    [
      'http://cats.launchdarkly.com/',
      'http://cats.launchdarkly.com',
      [
        { level: LogLevel.Warn, matches: /You have set custom uris without.* streamUri/ },
        { level: LogLevel.Warn, matches: /You have set custom uris without.* eventsUri/ },
      ],
    ],
    [
      0,
      'https://sdk.launchdarkly.com',
      [
        { level: LogLevel.Warn, matches: /Config option "baseUri" should be of type/ },
        { level: LogLevel.Warn, matches: /You have set custom uris without.* streamUri/ },
        { level: LogLevel.Warn, matches: /You have set custom uris without.* eventsUri/ },
      ],
    ],
  ])('allows setting the baseUri and validates the baseUri', (uri, expected, logs) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ baseUri: uri }));
    expect(config.serviceEndpoints.polling).toEqual(expected);
    expect(logger(config).getCount()).toEqual(logs.length);
    // There should not be any messages, so checking them for undefined is a workaround
    // for a lack of pure assert.
    logger(config).expectMessages(logs);
  });

  it.each([
    ['http://cats.launchdarkly.com', 'http://cats.launchdarkly.com', 2],
    ['http://cats.launchdarkly.com/', 'http://cats.launchdarkly.com', 2],
    [0, 'https://stream.launchdarkly.com', 3],
  ])('allows setting the streamUri and validates the streamUri', (uri, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ streamUri: uri }));
    expect(config.serviceEndpoints.streaming).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    ['http://cats.launchdarkly.com', 'http://cats.launchdarkly.com', 2],
    ['http://cats.launchdarkly.com/', 'http://cats.launchdarkly.com', 2],
    [0, 'https://events.launchdarkly.com', 3],
  ])('allows setting the eventsUri and validates the eventsUri', (uri, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ eventsUri: uri }));
    expect(config.serviceEndpoints.events).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it('produces no logs when setting all URLs.', () => {
    // @ts-ignore
    const config = new Configuration(
      withLogger({ eventsUri: 'cats', baseUri: 'cats', streamUri: 'cats' }),
    );
    expect(config.serviceEndpoints.events).toEqual('cats');
    expect(config.serviceEndpoints.streaming).toEqual('cats');
    expect(config.serviceEndpoints.polling).toEqual('cats');
    expect(logger(config).getCount()).toEqual(0);
  });

  it('Does not log a warning for the events URI if sendEvents is false..', () => {
    // @ts-ignore
    const config = new Configuration(
      withLogger({ sendEvents: false, baseUri: 'cats', streamUri: 'cats' }),
    );
    expect(config.serviceEndpoints.streaming).toEqual('cats');
    expect(config.serviceEndpoints.polling).toEqual('cats');
    expect(logger(config).getCount()).toEqual(0);
  });

  it('Does log a warning for the events URI if sendEvents is true..', () => {
    // @ts-ignore
    const config = new Configuration(
      withLogger({ sendEvents: true, baseUri: 'cats', streamUri: 'cats' }),
    );
    expect(config.serviceEndpoints.streaming).toEqual('cats');
    expect(config.serviceEndpoints.polling).toEqual('cats');
    expect(logger(config).getCount()).toEqual(1);
  });

  it.each([
    [0, 0, []],
    [6, 6, []],
    ['potato', 5, [{ level: LogLevel.Warn, matches: /Config option "timeout" should be of type/ }]],
  ])('allow setting timeout and validates timeout', (value, expected, logs) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ timeout: value }));
    expect(config.timeout).toEqual(expected);
    logger(config).expectMessages(logs);
  });

  it.each([
    [0, 0, []],
    [6, 6, []],
    [
      'potato',
      10000,
      [{ level: LogLevel.Warn, matches: /Config option "capacity" should be of type/ }],
    ],
  ])('allow setting and validates capacity', (value, expected, logs) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ capacity: value }));
    expect(config.eventsCapacity).toEqual(expected);
    logger(config).expectMessages(logs);
  });

  it.each([
    [0, 0, 0],
    [6, 6, 0],
    ['potato', 5, 1],
  ])('allow setting and validates flushInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ flushInterval: value }));
    expect(config.flushInterval).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [0, 30, 1],
    [500, 500, 0],
    ['potato', 30, 1],
  ])('allow setting and validates pollInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ pollInterval: value }));
    expect(config.pollInterval).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates offline', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ offline: value }));
    expect(config.offline).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates stream', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ stream: value }));
    expect(config.stream).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates useLdd', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ useLdd: value }));
    expect(config.useLdd).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates sendEvents', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ sendEvents: value }));
    expect(config.sendEvents).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates allAttributesPrivate', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ allAttributesPrivate: value }));
    expect(config.allAttributesPrivate).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [['a', 'b', 'c'], ['a', 'b', 'c'], 0],
    [[], [], 0],
    [[0], [], 1],
    ['potato', [], 1],
  ])('allows setting and validates privateAttributes', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ privateAttributes: value }));
    expect(config.privateAttributes).toStrictEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [500, 500, 0],
    ['potato', 1000, 1],
  ])('allow setting and validates contextKeysCapacity', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ contextKeysCapacity: value }));
    expect(config.contextKeysCapacity).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [500, 500, 0],
    ['potato', 300, 1],
  ])('allow setting and validates contextKeysFlushInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ contextKeysFlushInterval: value }));
    expect(config.contextKeysFlushInterval).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [false, false, 0],
    [true, true, 0],
    ['', false, 1],
    ['true', true, 1],
    [0, false, 1],
    [1, true, 1],
  ])('allows setting stream and validates diagnosticOptOut', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ diagnosticOptOut: value }));
    expect(config.diagnosticOptOut).toEqual(expected);
    expect(logger(config).getCount()).toEqual(warnings);
  });

  it.each([
    [
      0,
      60,
      [
        {
          level: LogLevel.Warn,
          matches: /Config option "diagnosticRecordingInterval" had invalid/,
        },
      ],
    ],
    [500, 500, []],
    [
      'potato',
      900,
      [
        {
          level: LogLevel.Warn,
          matches: /Config option "diagnosticRecordingInterval" should be of type/,
        },
      ],
    ],
  ])('allow setting and validates diagnosticRecordingInterval', (value, expected, logs) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ diagnosticRecordingInterval: value }));
    expect(config.diagnosticRecordingInterval).toEqual(expected);
    logger(config).expectMessages(logs);
  });

  it.each([
    ['1', '1', []],
    ['camelCaseWorks', 'camelCaseWorks', []],
    ['PascalCaseWorks', 'PascalCaseWorks', []],
    ['kebab-case-works', 'kebab-case-works', []],
    ['snake_case_works', 'snake_case_works', []],
    [
      'invalid-@-filter',
      undefined,
      [{ level: LogLevel.Warn, matches: /Config option "payloadFilterKey" should be of type/ }],
    ],
    [
      '_invalid-filter',
      undefined,
      [{ level: LogLevel.Warn, matches: /Config option "payloadFilterKey" should be of type/ }],
    ],
    [
      '-invalid-filter',
      undefined,
      [{ level: LogLevel.Warn, matches: /Config option "payloadFilterKey" should be of type/ }],
    ],
  ])('allow setting and validates payloadFilterKey', (filter, expected, logs) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ payloadFilterKey: filter }));
    expect(config.payloadFilterKey).toEqual(expected);
    logger(config).expectMessages(logs);
  });

  it('discards unrecognized options with a warning', () => {
    // @ts-ignore
    const config = new Configuration(withLogger({ yes: 'no', cat: 'yes' }));
    expect(logger(config).getCount()).toEqual(2);
    logger(config).expectMessages([
      {
        level: LogLevel.Warn,
        matches: /Ignoring unknown config option "yes"/,
      },
      {
        level: LogLevel.Warn,
        matches: /Ignoring unknown config option "cat"/,
      },
    ]);
  });

  // This is more thoroughly tested in the application tags test.
  it.each([
    [{ application: { id: 'valid-id', version: 'valid-version' } }, 0],
    [
      {
        application: {
          id: 'valid-id',
          version: 'valid-version',
          name: 'valid-name',
          versionName: 'valid-versionName',
        },
      },
      0,
    ],
    [{ application: 'tomato' }, 1],
  ])('handles application tag settings %j', (values, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ ...values }));
    expect(logger(config).getCount()).toEqual(warnings);
  });

  // Valid usage is covered in LDClient.hooks.test.ts
  test('non-array hooks should use default', () => {
    // @ts-ignore
    const config = new Configuration(withLogger({ hooks: 'hook!' }));
    expect(config.hooks).toBeUndefined();
    logger(config).expectMessages([
      {
        level: LogLevel.Warn,
        matches:
          /Config option "hooks" should be of type Hook\[\], got string, using default value/,
      },
    ]);
  });

  it('drop', () => {

  }
});
