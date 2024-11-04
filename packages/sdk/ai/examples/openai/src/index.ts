/* eslint-disable no-console */
import { OpenAI } from 'openai';

import { initAi } from '@launchdarkly/ai';
import { init, LDContext } from '@launchdarkly/node-server-sdk';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

// Validate required environment variables
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

if (!aiConfigKey) {
  console.error('*** Please set the LAUNCHDARKLY_AI_CONFIG_KEY env first');
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

async function main(): Promise<void> {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
    const aiClient = initAi(ldClient);

    const configValue = await aiClient.modelConfig(
      aiConfigKey,
      context,
      {
        model: {
          modelId: 'gpt-4',
        },
      },
      { myVariable: 'My User Defined Variable' },
    );

    const { tracker } = configValue;
    const completion = await tracker.trackOpenAI(async () =>
      client.chat.completions.create({
        messages: configValue.config.prompt || [],
        model: configValue.config.model?.modelId || 'gpt-4',
      }),
    );

    console.log('AI Response:', completion.choices[0]?.message.content);
    console.log('Success.');
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }
}

main();
