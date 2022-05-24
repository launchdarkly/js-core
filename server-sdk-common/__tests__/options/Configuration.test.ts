import { LDOptions } from '../../src';
import Configuration from '../../src/options/Configuration';
import TestLogger from '../Logger';

function withLogger(options: LDOptions): LDOptions {
  return {...options, logger: new TestLogger()};
}

function logger(options: LDOptions): TestLogger {
  return options.logger as TestLogger;
}

describe.each([
  undefined, null, "potat0", 17, [], {}
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
    ["http://cats.launchdarkly.com", "http://cats.launchdarkly.com", 0]
  ])('allows setting the baseUri and validates the baseUri', (uri, expected, warnings) => {
    const config = new Configuration(withLogger({baseUri: uri}));
    expect(config.serviceEndpoints.polling).toEqual(expected);
    expect(logger(config).warningMessages.length).toEqual(warnings);
  });
});