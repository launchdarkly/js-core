import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Set sdkKey to your LaunchDarkly SDK key.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set judgeKey to the Judge key you want to use.
const judgeKey = process.env.LAUNCHDARKLY_JUDGE_KEY || 'sample-judge';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [new Observability({ serviceName: 'js-server-ai-example-create-judge' })],
});

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
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
    console.log(
      `*** SDK failed to initialize. Please check your internet connection and SDK credential for any typo: ${error}`,
    );
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  try {
    // Pass a defaultValue for improved resiliency when the AI config is unavailable
    // or LaunchDarkly is unreachable; omit for a disabled default.
    // Example (enabled default; judge default has three messages):
    //   const defaultValue = {
    //     enabled: true,
    //     model: { name: 'gpt-4' },
    //     provider: { name: 'openai' },
    //     messages: [
    //       { role: 'system', content: 'Your judge criteria here.' },
    //       { role: 'assistant', content: 'MESSAGE HISTORY: {{message_history}}' },
    //       { role: 'user', content: 'RESPONSE TO EVALUATE: {{response_to_evaluate}}' },
    //     ],
    //   };
    //   const judge = await aiClient.createJudge(judgeKey, context, defaultValue);
    const judge = await aiClient.createJudge(judgeKey, context);

    if (!judge) {
      console.log(
        `AI config '${judgeKey}' is disabled. Verify the config key exists in your LaunchDarkly project and is not targeting a disabled variation.`,
      );
      return;
    }

    const inputText =
      'You are a helpful assistant for the company LaunchDarkly. How can you help me?';
    const outputText =
      'I can answer any question you have except for questions about the company LaunchDarkly.';

    console.log('\nEvaluating a sample input/output pair with the judge:');
    console.log(`  Sample input:  "${inputText}"`);
    console.log(`  Sample output: "${outputText}"`);
    console.log('Waiting for judge evaluation...');

    const judgeResult = await judge.evaluate(inputText, outputText);

    // If the output you're judging came from another AI Config, track the
    // result on that config's tracker so the metric is attributed to the
    // right config:
    // aiConfig.createTracker().trackJudgeResult(judgeResult);

    console.log('\nJudge result:');
    console.log(`- judge_config_key: ${judgeKey}`);
    console.log(`  sampled: ${judgeResult.sampled}`);
    if (judgeResult.sampled) {
      console.log(`  success: ${judgeResult.success}`);
      console.log(`  error_message: ${judgeResult.errorMessage}`);
      console.log(`  metric_key: ${judgeResult.metricKey}`);
      console.log(`  score: ${judgeResult.score}`);
      console.log(`  reasoning: ${judgeResult.reasoning}`);
    }

    console.log('\nDone!');
  } catch (err) {
    // In production, sanitize before logging — provider errors may include credentials.
    console.error('Error:', err);
  } finally {
    // Flush pending events and close the client.
    await ldClient.flush();
    ldClient.close();
  }
}

main();
