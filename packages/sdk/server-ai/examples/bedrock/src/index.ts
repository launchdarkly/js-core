/* eslint-disable no-console */
import { BedrockRuntimeClient, ConverseCommand, Message } from '@aws-sdk/client-bedrock-runtime';

import { init } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const awsClient = new BedrockRuntimeClient({ region: 'us-east-1' });

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

if (!aiConfigKey) {
  console.error('*** Please set the LAUNCHDARKLY_AI_CONFIG_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey);

// Set up the context properties
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

function mapPromptToConversation(
  prompt: { role: 'user' | 'assistant' | 'system'; content: string }[],
): Message[] {
  return prompt.map((item) => ({
    // Bedrock doesn't support systems in the converse command.
    role: item.role !== 'system' ? item.role : 'user',
    content: [{ text: item.content }],
  }));
}

async function main() {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  const aiConfig = await aiClient.config(
    aiConfigKey!,
    context,
    {
      model: {
        id: 'my-default-model',
      },
      enabled: true,
    },
    {
      myVariable: 'My User Defined Variable',
    },
  );
  const { tracker } = aiConfig;

  const completion = tracker.trackBedrockConverseMetrics(
    await awsClient.send(
      new ConverseCommand({
        modelId: aiConfig.model?.id ?? 'no-model',
        messages: mapPromptToConversation(aiConfig.messages ?? []),
        inferenceConfig: {
          temperature: (aiConfig.model?.parameters?.temperature as number) ?? 0.5,
          maxTokens: (aiConfig.model?.parameters?.maxTokens as number) ?? 4096,
        },
      }),
    ),
  );
  console.log('AI Response:', completion.output?.message?.content?.[0]?.text ?? 'no-response');
  console.log('Success.');
}

main();
