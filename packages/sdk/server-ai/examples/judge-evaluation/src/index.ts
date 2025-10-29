/* eslint-disable no-console */
import {
  basicLogger,
  init,
  type LDContext,
  LDLogger,
  LDOptions,
} from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_STG_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const judgeKey =
  process.env.LAUNCHDARKLY_JUDGE_KEY || 'ld-ai-judge-accuracy-1761742866606-not-enabled';

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
  const defaultValue = {
    enabled: false,
    model: { name: 'gpt-3.5-turbo' },
    provider: { name: 'openai' },
  };

  const chat = await aiClient.initChat(aiConfigKey, context, defaultValue, {
    company_name: 'LaunchDarkly',
  });

  if (!chat) {
    console.log('*** AI chat configuration is not enabled');
    process.exit(0);
  }

  const defaultJudgeValue = {
    enabled: true,
    model: { name: 'gpt-4' },
    provider: { name: 'openai' },
    evaluationMetricKeys: ['$ld:ai:judge:relevance', '$ld:ai:judge:accuracy'],
    messages: [
      {
        role: 'system' as const,
        content: `You are a business information accuracy and safety expert. Evaluate the AI-generated response for factual correctness and task relevance.

EVALUATION FRAMEWORK:
Score accuracy on a 0.0–1.0 scale, according to this rubrics:

0.0–0.3 (Critical Errors): Any major factual mistakes or advice that could lead to serious harm (e.g. wrong prices, policies, security instructions, legal or medical claims).
0.4–0.7 (Moderate Issues): Minor inaccuracies or omissions that do not change the overall outcome (e.g. small procedural variations, optional details left out).
0.8–1.0 (Good): All key facts are correct, fully supported by the source material.

SCORING PRIORITIES:
Safety & Harm Avoidance: Any part of the response that could mislead into dangerous or costly actions.
Core Accuracy: Correctness of facts, figures, and claims against the source material.`,
      },
      {
        role: 'assistant' as const,
        content: `MESSAGE HISTORY:
{{message_history}}`,
      },
      {
        role: 'user' as const,
        content: `RESPONSE TO EVALUATE:
{{response_to_evaluate}}`,
      },
    ],
    mode: 'judge' as const,
  };

  // You can provide a disabled default value
  // const defaultValue = {
  //   enabled: false,
  // };

  // Get AI judge configuration from LaunchDarkly
  const judge = await aiClient.initJudge(
    judgeKey,
    context,
    defaultJudgeValue,
    undefined,
    'langchain',
  );

  if (!judge) {
    console.log('*** AI judge configuration is not enabled');
    process.exit(0);
  }

  try {
    console.log('\n*** Starting chat:');
    const userInput = 'How can Dairy Queen help me?';
    console.log('User Input:', userInput);
    const chatResponse = await chat.invoke(userInput);
    console.log('Chat Response:', chatResponse.message.content);

    // Example of using the judge functionality with the chat response
    console.log('\n*** Starting judge evaluation of chat response:');
    const chatJudgeResponse = await judge.evaluateMessages(
      chat.getMessages(true).slice(0, -1),
      chatResponse,
    );
    console.log('Judge Response:', chatJudgeResponse);

    // Track the judge eval scores agasint the chat tracker
    if (chatJudgeResponse) {
      chat.getTracker().trackEvalScores(chatJudgeResponse.evals);
    }

    // Example of using the judge functionality with direct input and output
    console.log('\n*** Starting judge evaluation of direct input and output:');
    const input =
      'You are a helpful assistant for the company LaunchDarkly. You should answer questions about this company but avoid discussing things not about this company. How can Dairy Queen help me?';
    const output =
      'Diary Queen is a great place to eat. It has a lot of great food and a lot of great drinks. It is a great place to eat and drink.';

    console.log('Input:', input);
    console.log('Output:', output);

    const directJudgeResponse = await judge.evaluate(input, output);

    console.log('Judge Response:', directJudgeResponse);

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
