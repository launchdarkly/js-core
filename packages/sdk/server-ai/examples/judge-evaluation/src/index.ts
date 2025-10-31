/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config({ override: true });

import {
  basicLogger,
  init,
  type LDContext,
  LDLogger,
  LDOptions,
} from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const judgeKey =
  process.env.LAUNCHDARKLY_JUDGE_KEY || 'ld-ai-judge-accuracy';

// Validate required environment variables
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}
const logger: LDLogger = basicLogger({
  level: 'warn',
  destination: console.log,
});
const options: LDOptions = {
  logger,
  streamUri: 'https://stream-stg.launchdarkly.com',
  eventsUri: 'https://events-stg.launchdarkly.com',
  baseUri: 'https://api-stg.launchdarkly.com',
};

// Initialize LaunchDarkly client
const ldClient = init(sdkKey, options);

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

  try {
    // Example using the chat functionality which automates the judge evaluation
    const defaultValue = {
      enabled: false,
    };

    const chat = await aiClient.initChat(aiConfigKey, context, defaultValue, {
      company_name: 'LaunchDarkly',
    });

    if (!chat) {
      console.log('*** AI chat configuration is not enabled');
      process.exit(0);
    }

    console.log('\n*** Starting chat:');
    const userInput = 'How can LaunchDarkly help me?';
    console.log('User Input:', userInput);
    const chatResponse = await chat.invoke(userInput);
    console.log('Chat Response:', chatResponse.message.content);

    // Log judge evaluation results with full detail
    const evalResults = await chatResponse.evaluations;
    console.log('Judge results:', JSON.stringify(evalResults, null, 2));

    // Example of using the judge functionality with direct input and output
    // Get AI judge configuration from LaunchDarkly
    const judge = await aiClient.initJudge(
      judgeKey,
      context,
      { enabled: false },
      undefined,
      'langchain',
    );

    if (!judge) {
      console.log('*** AI judge configuration is not enabled');
      process.exit(0);
    }

    console.log('\n*** Starting judge evaluation of direct input and output:');
    const input =
      'You are a helpful assistant for the company LaunchDarkly. How can you help me?';
    const output =
      'I can answer any question you have except for questions about the company LaunchDarkly.';

    console.log('Input:', input);
    console.log('Output:', output);

    const judgeResponse = await judge.evaluate(input, output);

    console.log('Judge Response:', judgeResponse);

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
