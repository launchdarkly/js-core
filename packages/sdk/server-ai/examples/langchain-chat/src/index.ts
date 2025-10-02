/* eslint-disable no-console */
import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

// Validate required environment variables
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

// Initialize LaunchDarkly client
const ldClient = init(sdkKey, { eventsUri: 'https://fd9486c18583.ngrok-free.app' });

// Set up the context properties. This context should appear on your LaunchDarkly contexts dashboard
// soon after you run the demo.
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
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);
  const defaultValue = {
    enabled: true,
    model: { name: 'gpt-3.5-turbo' },
    messages: [{ role: 'system' as const, content: 'You are a helpful assistant.' }],
    provider: { name: 'openai' },
  };

  // You provide a disabled default value
  // const defaultValue = {
  //   enabled: false,
  // };

  // Get AI chat configuration from LaunchDarkly
  const chat = await aiClient.initChat(aiConfigKey, context, defaultValue, {
    myVariable: 'My User Defined Variable',
  });

  if (!chat) {
    console.log('*** AI chat configuration is not enabled');
    process.exit(0);
  }

  // Example of using the chat functionality
  console.log('\n*** Starting chat conversation:');
  try {
    const userInput = 'Hello! Can you help me understand what LaunchDarkly is?';
    console.log('User Input:', userInput);

    const response = await chat.invoke(userInput);

    console.log('AI Response:', response.message.content);

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
