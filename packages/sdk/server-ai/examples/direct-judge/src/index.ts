/* eslint-disable no-console */
import dotenv from 'dotenv';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

dotenv.config({ override: true });

// Environment variables
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const judgeKey = process.env.LAUNCHDARKLY_JUDGE_KEY || 'ld-ai-judge-accuracy';

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

  try {
    const judge = await aiClient.createJudge(judgeKey, context, { enabled: false });

    if (!judge) {
      console.log('*** AI judge configuration is not enabled');
      process.exit(0);
    }

    console.log('\n*** Starting direct judge evaluation of input and output:');
    const input = 'You are a helpful assistant for the company LaunchDarkly. How can you help me?';
    const output =
      'I can answer any question you have except for questions about the company LaunchDarkly.';

    console.log('Input:', input);
    console.log('Output:', output);

    const judgeResponse = await judge.evaluate(input, output);

    // Track the judge evaluation scores on the tracker for the aiConfig you are evaluating.
    // Example:
    // aiConfig.tracker.trackEvalScores(judgeResponse?.evals);

    console.log('Judge Response:', judgeResponse);

    console.log('Success.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
