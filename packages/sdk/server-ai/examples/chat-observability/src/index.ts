/* eslint-disable no-console */
import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const serviceName = process.env.SERVICE_NAME || 'hello-js-ai-observability';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [
    new Observability({
      serviceName,
      serviceVersion,
    }),
  ],
});

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
  environment: 'observability-demo',
  tier: 'premium',
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
  const defaultValue = {
    enabled: false,
  };

  const chat = await aiClient.createChat(aiConfigKey, context, defaultValue, {
    example_type: 'observability_demo',
    session_id: 'demo-session-123',
    feature: 'ai_chat',
  });

  if (!chat) {
    console.log('*** AI chat configuration is not enabled');
    ldClient.close();
    process.exit(0);
  }

  try {
    const userInput1 = 'What is feature flagging in 2 sentences?';
    console.log('User Input:', userInput1);
    const response1 = await chat.invoke(userInput1);
    console.log('Chat Response:', response1.message.content);

    const userInput2 = 'Give me a specific use case example.';
    console.log('\nUser Input:', userInput2);
    const response2 = await chat.invoke(userInput2);
    console.log('Chat Response:', response2.message.content);

    console.log('\nSuccess.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    ldClient.close();
  }
}

main();
