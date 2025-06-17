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
    // @ts-ignore
    environmentId: 12345,
  });

  expect(messages.length).toEqual(3);
  expect(messages[0]).toEqual(
    'error: [LaunchDarkly] Config option "includeVariant" should be of type boolean, got string, using default value',
  );
  expect(messages[1]).toEqual(
    'error: [LaunchDarkly] Config option "spans" should be of type boolean, got string, using default value',
  );
  expect(messages[2]).toEqual(
    'error: [LaunchDarkly] Config option "environmentId" should be of type string, got number, using default value',
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
    expect(spanEvent.attributes!['feature_flag.provider.name']).toEqual('LaunchDarkly');
    expect(spanEvent.attributes!['feature_flag.context.id']).toEqual('user-key');
    expect(spanEvent.attributes!['feature_flag.result.value']).toBeUndefined();
    expect(spanEvent.attributes!['feature_flag.set.id']).toBeUndefined();
  });

  it.each(['includeVariant', 'includeValue'])(
    'can include value in span events',
    async (optKey) => {
      const td = new integrations.TestData();
      const client = init('bad-key', {
        sendEvents: false,
        updateProcessor: td.getFactory(),
        hooks: [new TracingHook({ [optKey]: true })],
      });

      const tracer = trace.getTracer('trace-hook-test-tracer');
      await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
        await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
        span.end();
      });

      const spans = spanExporter.getFinishedSpans();
      const spanEvent = spans[0]!.events[0]!;
      expect(spanEvent.attributes!['feature_flag.result.value']).toEqual('false');
    },
  );

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
    expect(variationSpan.attributes['feature_flag.context.id']).toEqual('user-key');
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
    expect(spanEvent.attributes!['feature_flag.context.id']).toEqual('org:org-key:user:bob');
  });

  it('can include environmentId from options', async () => {
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [new TracingHook({ environmentId: 'id-from-options' })],
    });

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.attributes!['feature_flag.set.id']).toEqual('id-from-options');
  });

  it('can include environmentId from hook context', async () => {
    const hook = new TracingHook();
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [hook],
    });

    jest.spyOn(hook, 'afterEvaluation').mockImplementationOnce((hookContext, data, detail) =>
      // @ts-ignore
      hook.afterEvaluation?.(
        { ...hookContext, environmentId: 'id-from-hook-context' },
        data,
        detail,
      ),
    );

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.attributes!['feature_flag.set.id']).toEqual('id-from-hook-context');
  });

  it('can override hook context environmentId with options', async () => {
    const hook = new TracingHook({ environmentId: 'id-from-options' });
    const td = new integrations.TestData();
    const client = init('bad-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
      hooks: [hook],
    });

    jest.spyOn(hook, 'afterEvaluation').mockImplementationOnce((hookContext, data, detail) =>
      // @ts-ignore
      hook.afterEvaluation?.(
        { ...hookContext, environmentId: 'id-from-hook-context' },
        data,
        detail,
      ),
    );

    const tracer = trace.getTracer('trace-hook-test-tracer');
    await tracer.startActiveSpan('test-span', { root: true }, async (span) => {
      await client.boolVariation('test-bool', { kind: 'user', key: 'user-key' }, false);
      span.end();
    });

    const spans = spanExporter.getFinishedSpans();
    const spanEvent = spans[0]!.events[0]!;
    expect(spanEvent.attributes!['feature_flag.set.id']).toEqual('id-from-options');
  });

  it('includes inExperiment attribute in span events', async () => {
    const td = new integrations.TestData();
    td.usePreconfiguredFlag({
      key: 'test-bool',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: {
        rollout: {
          kind: 'experiment',
          variations: [
            {
              weight: 100000,
              variation: 0,
            },
          ],
        },
      },
      variations: [true, false],
    });
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
    expect(spanEvent.attributes!['feature_flag.result.reason.inExperiment']).toEqual(true);
  });

  it('includes variationIndex attribute in span events', async () => {
    const td = new integrations.TestData();
    td.usePreconfiguredFlag({
      key: 'test-bool',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: {
        variation: 1,
      },
      variations: [true, false],
    });
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
    expect(spanEvent.attributes!['feature_flag.result.variationIndex']).toEqual(1);
  });

  it('does not include inExperiment attribute when not in experiment', async () => {
    const td = new integrations.TestData();
    td.usePreconfiguredFlag({
      key: 'test-bool',
      version: 1,
      on: true,
      targets: [],
      rules: [],
      fallthrough: {
        variation: 0,
      },
      variations: [true, false],
    });
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
    expect(spanEvent.attributes!['feature_flag.result.reason.inExperiment']).toBeUndefined();
  });
});
