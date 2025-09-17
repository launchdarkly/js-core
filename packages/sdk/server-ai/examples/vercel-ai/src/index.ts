/* eslint-disable no-console */
import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

import { init, type LDClient, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY ?? '';
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

// Validate required environment variables
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

let client: LDClient | undefined;

async function main() {
  // Initialize LaunchDarkly client
  client = init(sdkKey);

  // Set up the context properties. This context should appear on your LaunchDarkly contexts dashboard
  const context: LDContext = {
    kind: 'user',
    key: 'example-user-key',
    name: 'Sandy',
  };

  try {
    await client.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(client);

  // Get AI configuration from LaunchDarkly
  const aiConfig = await aiClient.config(aiConfigKey, context, { model: { name: 'gpt-4' } });

  if (!aiConfig.enabled) {
    console.log('*** AI configuration is not enabled');
    process.exit(0);
  }

  console.log('Using model:', aiConfig.model?.name);

  // Example of using generateText (non-streaming)
  console.log('\n*** Generating text:');
  try {
    const result = await aiConfig.tracker.trackVercelAISDKGenerateTextMetrics(() =>
      generateText(aiConfig.toVercelAISDK(openai)),
    );
    console.log('Response:', result.text);

    process.stdout.write('Streaming Response: ');
    const streamResult = aiConfig.tracker.trackVercelAISDKStreamTextMetrics(() =>
      streamText(aiConfig.toVercelAISDK(openai)),
    );

    // eslint-disable-next-line no-restricted-syntax
    for await (const textPart of streamResult.textStream) {
      process.stdout.write(textPart);
    }

    console.log('\nSuccess.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await client?.flush();
    client?.close();
  });
