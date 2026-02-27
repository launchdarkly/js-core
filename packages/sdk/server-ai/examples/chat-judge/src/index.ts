/* eslint-disable no-console */
import dotenv from 'dotenv';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

dotenv.config({ override: true });

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

// Validate required environment variables
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

// Initialize LaunchDarkly client
const ldClient = init(sdkKey);

// Set up the context properties. This context should appear on your LaunchDarkly contexts dashboard
// soon after you run the demo.
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
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  try {
    const defaultValue = {
      enabled: false,
    };

    const chat = await aiClient.createChat(aiConfigKey, context, defaultValue, {
      companyName: 'LaunchDarkly',
    });

    if (!chat) {
      console.log('*** AI chat configuration is not enabled');
      process.exit(0);
    }

    console.log('\n*** Starting chat with automatic judge evaluation:');
    const userInput = 'How can LaunchDarkly help me?';
    console.log('User Input:', userInput);

    // The invoke method will automatically evaluate the chat response with any judges defined
    // in the AI config.
    const chatResponse = await chat.invoke(userInput);
    console.log('Chat Response:', chatResponse.message.content);

    // Judge evaluations run asynchronously and do not block your application.
    // Results are automatically sent to LaunchDarkly for AI config metrics.
    // You only need to await if you want to access the evaluation results in your code.
    const evalResults = await chatResponse.evaluations;
    console.log('Judge results:', JSON.stringify(evalResults, null, 2));

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
