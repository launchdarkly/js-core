/* eslint-disable no-console */
import { OpenAI } from 'openai';

import { init, LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';
import { OpenAIProvider } from '@launchdarkly/server-sdk-ai-openai';

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

async function main() {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  const aiConfig = await aiClient.completionConfig(
    aiConfigKey,
    context,
    {
      model: {
        name: 'gpt-4',
      },
      enabled: false,
    },
    { myVariable: 'My User Defined Variable' },
  );

  if (!aiConfig.enabled || !aiConfig.tracker) {
    console.log('*** AI configuration is not enabled');
    process.exit(0);
  }

  const completion = await aiConfig.tracker.trackMetricsOf(
    OpenAIProvider.createAIMetrics,
    async () =>
      client.chat.completions.create({
        messages: aiConfig.messages || [],
        model: aiConfig.model?.name || 'gpt-4',
        temperature: (aiConfig.model?.parameters?.temperature as number) ?? 0.5,
        max_tokens: (aiConfig.model?.parameters?.maxTokens as number) ?? 4096,
      }),
  );

  console.log('AI Response:', completion.choices[0]?.message.content);
  console.log('Success.');
}

main();
