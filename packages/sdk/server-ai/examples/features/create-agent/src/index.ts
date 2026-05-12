/* eslint-disable no-console */
import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-agent-config';

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

  // Get AI agent configuration from LaunchDarkly.
  //
  // Pass a defaultValue for improved resiliency when the flag is unavailable or LaunchDarkly is unreachable; omit for a disabled default.
  // Example:
  //   const defaultValue = {
  //     enabled: true,
  //     model: { name: 'gpt-4' },
  //     provider: { name: 'openai' },
  //     instructions: 'You are a helpful research assistant for {{companyName}}.'
  //   };
  //   const agent = await aiClient.createAgent(aiConfigKey, context, defaultValue, { companyName: 'LaunchDarkly' });
  const agent = await aiClient.createAgent(aiConfigKey, context, undefined, {
    companyName: 'LaunchDarkly',
  });

  if (!agent) {
    console.log('*** AI agent configuration is not enabled');
    process.exit(0);
  }

  // Example of using the agent functionality
  console.log('\n*** Starting agent invocation:');
  try {
    const userInput = 'Hello! Can you help me understand how your company can help me?';
    console.log('User Input:', userInput);

    const result = await agent.run(userInput);

    console.log('AI Response:', result.content);

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
