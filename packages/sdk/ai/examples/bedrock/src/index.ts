/* eslint-disable no-console */
import {
  BedrockRuntimeClient,
  ConversationRole,
  ConverseCommand,
  Message,
} from '@aws-sdk/client-bedrock-runtime';

import { initAi, LDAIConfig } from '@launchdarkly/ai';
import { init } from '@launchdarkly/node-server-sdk';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const awsClient = new BedrockRuntimeClient({ region: 'us-east-1' });

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey);

// Set up the context properties
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

console.log('*** SDK successfully initialized');

interface MyModelConfig {
  modelId: string;
  prompt: { role: ConversationRole; content: string }[];
}

function mapPromptToConversation(prompt: { role: ConversationRole; content: string }[]): Message[] {
  return prompt.map((item) => ({
    role: item.role,
    content: [{ text: item.content }],
  }));
}

async function main() {
  let tracker;
  let configValue: LDAIConfig | false;

  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    const aiClient = initAi(ldClient);

    configValue = await aiClient.modelConfig(aiConfigKey, context, false, {
      myVariable: 'My User Defined Variable',
    });
    if (configValue === false) {
      console.log('got default value for config');
      process.exit(1);
    } else {
      tracker = configValue.tracker;
    }
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  if (tracker) {
    const modelConfig = configValue.config as MyModelConfig;
    const completion = await tracker.trackBedrockConverse(
      await awsClient.send(
        new ConverseCommand({
          modelId: modelConfig.modelId,
          messages: mapPromptToConversation(modelConfig.prompt),
        }),
      ),
    );

    console.log('AI Response:', completion.output.message.content[0].text);
    console.log('Success.');
  }
}

main();
