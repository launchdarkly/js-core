import { LDOptions } from '../../src';
import Configuration from '../../src/options/Configuration';
import OptionMessages from '../../src/options/OptionMessages';
import TestLogger from '../Logger';

function withLogger(options: LDOptions): LDOptions {
  return { ...options, logger: new TestLogger() };
}

function logger(options: LDOptions): TestLogger {
  return options.logger as TestLogger;
}

describe.each([
  undefined, null, 'potat0', 17, [], {},
])('constructed without options', (input) => {
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
  });
});

describe('when setting different options', () => {
  it.each([
    ['http://cats.launchdarkly.com', 'http://cats.launchdarkly.com', 0],
    ['http://cats.launchdarkly.com/', 'http://cats.launchdarkly.com', 0],
    [0, 'https://sdk.launchdarkly.com', 1],
  ])('allows setting the baseUri and validates the baseUri', (uri, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ baseUri: uri }));
    expect(config.serviceEndpoints.polling).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
    if (warnings) {
      expect(logger(config).warningMessages[0]).toEqual(
        OptionMessages.wrongOptionType('baseUri', 'string', typeof uri),
      );
    }
  });

  it.each([
    ['http://cats.launchdarkly.com', 'http://cats.launchdarkly.com', 0],
    ['http://cats.launchdarkly.com/', 'http://cats.launchdarkly.com', 0],
    [0, 'https://stream.launchdarkly.com', 1],
  ])('allows setting the streamUri and validates the streamUri', (uri, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ streamUri: uri }));
    expect(config.serviceEndpoints.streaming).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    ['http://cats.launchdarkly.com', 'http://cats.launchdarkly.com', 0],
    ['http://cats.launchdarkly.com/', 'http://cats.launchdarkly.com', 0],
    [0, 'https://events.launchdarkly.com', 1],
  ])('allows setting the eventsUri and validates the eventsUri', (uri, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ eventsUri: uri }));
    expect(config.serviceEndpoints.events).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [6, 6, 0],
    ['potato', 5, 1],
  ])('allow setting timeout and validates timeout', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ timeout: value }));
    expect(config.timeout).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [6, 6, 0],
    ['potato', 10000, 1],
  ])('allow setting and validates capacity', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ capacity: value }));
    expect(config.eventsCapacity).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [6, 6, 0],
    ['potato', 5, 1],
  ])('allow setting and validates flushInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ flushInterval: value }));
    expect(config.flushInterval).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 30, 1],
    [500, 500, 0],
    ['potato', 30, 1],
  ])('allow setting and validates pollInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ pollInterval: value }));
    expect(config.pollInterval).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [500, 500, 0],
    ['potato', 1000, 1],
  ])('allow setting and validates contextKeysCapacity', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ contextKeysCapacity: value }));
    expect(config.contextKeysCapacity).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 0, 0],
    [500, 500, 0],
    ['potato', 300, 1],
  ])('allow setting and validates contextKeysFlushInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ contextKeysFlushInterval: value }));
    expect(config.contextKeysFlushInterval).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
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
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });

  it.each([
    [0, 60, 1],
    [500, 500, 0],
    ['potato', 900, 1],
  ])('allow setting and validates diagnosticRecordingInterval', (value, expected, warnings) => {
    // @ts-ignore
    const config = new Configuration(withLogger({ diagnosticRecordingInterval: value }));
    expect(config.diagnosticRecordingInterval).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
    if (warnings) {
      expect(logger(config).warningMessages[0]).toEqual(
        value < 60
          ? OptionMessages.optionBelowMinimum('diagnosticRecordingInterval', value as number, 60)
          : OptionMessages.wrongOptionType('diagnosticRecordingInterval', 'number with minimum value of 60', typeof value),
      );
    }
  });

  it('discards unrecognized options with a warning', () => {
    // @ts-ignore
    const config = new Configuration(withLogger({ yes: 'no', cat: 'yes' }));
    expect(logger(config).warningMessages.length).toEqual(2);

    expect(logger(config).warningMessages[0]).toEqual(
      OptionMessages.unknownOption('yes'),
    );
    expect(logger(config).warningMessages[1]).toEqual(
      OptionMessages.unknownOption('cat'),
    );
  });

  // This is more thoroughly tested in the application tags test.
  it.each([
    [{application: {id: 'valid-id', version: 'valid-version'}}, 0],
    [{application: "tomato"}, 1]
  ])('handles application tag settings', (values, warnings) => {
      // @ts-ignore
      const config = new Configuration(withLogger({ ...values }));
      expect(logger(config).warningMessages.length).toEqual(warnings);
  });
});
