/* eslint-disable no-console */
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OpenAIInstrumentation } from '@traceloop/instrumentation-openai';
import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';
import { OpenAIProvider } from '@launchdarkly/server-sdk-ai-openai';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

// ── 1. Initialize the LaunchDarkly client with the Observability plugin ──
// The plugin automatically captures SDK operations, flag evaluations,
// error monitoring, logging, and distributed tracing.
const ldClient = init(sdkKey, {
  plugins: [
    new Observability({
      serviceName: process.env.SERVICE_NAME || 'hello-js-openai-observability',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    }),
  ],
});

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation()],
});

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

async function main() {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.error(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  // ── 2. Create your own OpenAI client (after instrumentations so OpenLLMetry can patch it) ──
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // ── 3. Get the AI Config (model, messages, parameters) from LaunchDarkly ──
  // `completionConfig` returns the resolved configuration plus a `tracker`
  // that you use to report metrics back to LaunchDarkly.
  const aiConfig = await aiClient.completionConfig(
    aiConfigKey,
    context,
    {
      model: { name: 'gpt-4' },
      enabled: false,
    },
    { example_type: 'provider_observability_demo' },
  );

  if (!aiConfig.enabled || !aiConfig.tracker) {
    console.log('*** AI configuration is not enabled');
    ldClient.close();
    process.exit(0);
  }

  try {
    // ── 4. Call OpenAI and track metrics with the provider's extractor ──
    const completion = await aiConfig.tracker.trackMetricsOf(
      OpenAIProvider.getAIMetricsFromResponse,
      () =>
        openai.chat.completions.create({
          messages: aiConfig.messages || [],
          model: aiConfig.model?.name || 'gpt-4',
          temperature: (aiConfig.model?.parameters?.temperature as number) ?? 0.5,
          max_tokens: (aiConfig.model?.parameters?.maxTokens as number) ?? 4096,
        }),
    );

    console.log('AI Response:', completion.choices[0]?.message.content);
    console.log('\nSuccess.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    ldClient.close();
  }
}

main();
