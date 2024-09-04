import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';

import { basicLogger, init, integrations } from '@launchdarkly/node-server-sdk';

import TracingHook from '../src/TracingHook';

const spanExporter = new InMemorySpanExporter();
const sdk = new NodeSDK({
  serviceName: 'ryan-test',
  spanProcessors: [new SimpleSpanProcessor(spanExporter)],
});
sdk.start();

it('validates configuration', async () => {
  const messages: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hook = new TracingHook({
    // @ts-ignore
    spans: 'potato',
    // @ts-ignore
    includeVariant: 'potato',
    logger: basicLogger({
      destination: (text) => {
        messages.push(text);
      },
    }),
  });

  expect(messages.length).toEqual(2);
  expect(messages[0]).toEqual(
    'error: [LaunchDarkly] Config option "includeVariant" should be of type boolean, got string, using default value',
  );
  expect(messages[1]).toEqual(
    'error: [LaunchDarkly] Config option "spans" should be of type boolean, got string, using default value',
  );
});

it('instance can be created with default config', () => {
  expect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hook = new TracingHook();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hook2 = new TracingHook({});
  }).not.toThrow();
});

describe('with a testing otel span collector', () => {
  afterEach(async () => {
    spanExporter.reset();
  });

  it('produces span events', async () => {
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [new TracingHook()],
    });

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.name).toEqual('feature_flag');
    expect(spanEvent.attributes!['feature_flag.key']).toEqual('test-bool');
    expect(spanEvent.attributes!['feature_flag.provider_name']).toEqual('LaunchDarkly');
    expect(spanEvent.attributes!['feature_flag.context.key']).toEqual('user-key');
    expect(spanEvent.attributes!['feature_flag.variant']).toBeUndefined();
  });

  it('can include variant in span events', async () => {
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [new TracingHook({ includeVariant: true })],
    });

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.attributes!['feature_flag.variant']).toEqual('false');
  });

  it('can include variation spans', async () => {
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [new TracingHook({ spans: true })],
    });

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const variationSpan = spans[0];
    expect(variationSpan.name).toEqual('LDClient.boolVariation');
    expect(variationSpan.attributes['feature_flag.context.key']).toEqual('user-key');
  });

  it('can handle multi-context key requirements', async () => {
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [new TracingHook()],
    });

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation(
        'test-bool',
        { kind: 'multi', user: { key: 'bob' }, org: { key: 'org-key' } },
        false,
      );
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.attributes!['feature_flag.context.key']).toEqual('org:org-key:user:bob');
  });
});
