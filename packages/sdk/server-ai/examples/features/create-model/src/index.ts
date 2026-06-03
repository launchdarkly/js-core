import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Set sdkKey to your LaunchDarkly SDK key.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set completionKey to the AI Config key you want to evaluate.
const completionKey = process.env.LAUNCHDARKLY_COMPLETION_KEY || 'sample-completion';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [new Observability({ serviceName: 'js-server-ai-example-create-model' })],
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
    // Example:
    //   const defaultValue = {
    //     enabled: true,
    //     model: { name: 'gpt-4' },
    //     provider: { name: 'openai' },
    //     messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
    //   };
    //   const model = await aiClient.createModel(completionKey, context, defaultValue, { companyName: 'LaunchDarkly' });
    const model = await aiClient.createModel(completionKey, context, undefined, {
      companyName: 'LaunchDarkly',
    });

    if (!model) {
      console.log(
        `AI config '${completionKey}' is disabled. Verify the config key exists in your LaunchDarkly project and is not targeting a disabled variation.`,
      );
      return;
    }

    const sampleQuestion = 'How can LaunchDarkly help me?';
    console.log(`\nSending sample question: "${sampleQuestion}"`);
    console.log('Waiting for response...');

    const result = await model.run(sampleQuestion);
    console.log(`\nModel response:\n${result.content}`);

    const summary = result.metrics;
    console.log('\nDone! The AI config was evaluated and the following metrics were tracked:');
    console.log(`  Duration:      ${summary.durationMs}ms`);
    console.log(`  Success:       ${summary.success}`);
    if (summary.tokens) {
      console.log(`  Input tokens:  ${summary.tokens.input}`);
      console.log(`  Output tokens: ${summary.tokens.output}`);
      console.log(`  Total tokens:  ${summary.tokens.total}`);
    }
    if (summary.toolCalls?.length) {
      console.log(`  Tool calls:    ${summary.toolCalls.join(', ')}`);
    }

    // Judge evaluations run asynchronously. Await them so they complete before
    // the process or request ends - even if you don't need to log or use the
    // results.
    if (result.evaluations) {
      const evalResults = await result.evaluations;
      if (evalResults.length === 0) {
        console.log(
          '\nNo judge evaluations were performed. Try adding a judge to the AI config to see results.',
        );
      } else {
        console.log('\nJudge results:');
        for (const judgeResult of evalResults) {
          console.log(`- judge_config_key: ${judgeResult.judgeConfigKey}`);
          console.log(`  sampled: ${judgeResult.sampled}`);
          if (!judgeResult.sampled) continue;
          console.log(`  success: ${judgeResult.success}`);
          console.log(`  error_message: ${judgeResult.errorMessage}`);
          console.log(`  metric_key: ${judgeResult.metricKey}`);
          console.log(`  score: ${judgeResult.score}`);
          console.log(`  reasoning: ${judgeResult.reasoning}`);
        }
      }
    } else {
      console.log(
        '\nNo judge evaluations were performed. Try adding a judge to the AI config to see results.',
      );
    }
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
