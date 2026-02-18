/* eslint-disable no-console */
/**
 * Init MUST be first so LaunchDarkly SDK and OpenLLMetry are set up before any
 * LLM provider code loads. See https://launchdarkly.com/docs/home/observability/llm-observability
 */
import { ldClient } from './init';

import type { LDContext } from '@launchdarkly/node-server-sdk';
import { LDObserve } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';

const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
  environment: 'observability-demo',
  tier: 'premium',
};

async function main(): Promise<void> {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.error(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  LDObserve.runWithHeaders('runChat', {}, async (span) => {
    const aiClient = initAi(ldClient);
    const defaultValue = {
      enabled: false,
    };

    const chat = await aiClient.createChat(aiConfigKey, context, defaultValue, {
      example_type: 'observability_demo',
      session_id: 'demo-session-123',
      feature: 'ai_chat',
    });

    if (!chat) {
      console.log('*** AI chat configuration is not enabled');
      ldClient.close();
      span.end();
      return;
    }

    try {
      const userInput1 = 'What is feature flagging in 2 sentences?';
      console.log('User Input:', userInput1);
      const response1 = await chat.invoke(userInput1);
      console.log('Chat Response:', response1.message.content);

      const userInput2 = 'Give me a specific use case example.';
      console.log('\nUser Input:', userInput2);
      const response2 = await chat.invoke(userInput2);
      console.log('Chat Response:', response2.message.content);

      console.log('\nSuccess.');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      ldClient.close();
      span.end();
    }
  });
}

main();
