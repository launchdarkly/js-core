/* eslint-disable no-console */
import 'dotenv/config';

import { basicLogger, init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

// The Observability plugin sets up the OpenTelemetry TracerProvider. The OpenAI
// provider package automatically patches its ESM module for tracing when it
// detects an active TracerProvider and @traceloop/instrumentation-openai.
const ldClient = init(sdkKey, {
  logger: basicLogger({ level: 'debug', destination: console.log }),
  plugins: [
    new Observability({
      serviceName: process.env.SERVICE_NAME || 'hello-js-ai-observability',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    }),
  ],
});

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

async function main(): Promise<void> {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.error(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);
  const chat = await aiClient.createChat(
    aiConfigKey,
    context,
    { enabled: false },
    {
      example_type: 'observability_demo',
    },
  );

  if (!chat) {
    console.log('*** AI chat configuration is not enabled');
    ldClient.close();
    process.exit(0);
  }

  try {
    const userInput = 'What is feature flagging in 2 sentences?';
    console.log('User Input:', userInput);

    const response = await chat.invoke(userInput);
    console.log('Chat Response:', response.message.content);

    console.log('\nSuccess.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    ldClient.close();
  }
}

main();
