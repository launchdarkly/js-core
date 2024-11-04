/* eslint-disable no-console */
import { BedrockRuntimeClient, ConverseCommand, Message } from '@aws-sdk/client-bedrock-runtime';

import { initAi, LDAIConfig } from '@launchdarkly/node-server-sdk-ai';
import { init } from '@launchdarkly/node-server-sdk';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY;
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
  let tracker;
  let configValue: LDAIConfig | false;

  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
    const aiClient = initAi(ldClient);

    configValue = await aiClient.modelConfig(
      aiConfigKey!,
      context,
      {
        model: {
          modelId: 'my-default-model',
        },
      },
      {
        myVariable: 'My User Defined Variable',
      },
    );
    tracker = configValue.tracker;
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  if (tracker) {
    const completion = tracker.trackBedrockConverse(
      await awsClient.send(
        new ConverseCommand({
          modelId: configValue.config.model?.modelId ?? 'no-model',
          messages: mapPromptToConversation(configValue.config.prompt ?? []),
        }),
      ),
    );

    console.log('AI Response:', completion.output?.message?.content?.[0]?.text ?? 'no-response');
    console.log('Success.');
  }
}

main();
