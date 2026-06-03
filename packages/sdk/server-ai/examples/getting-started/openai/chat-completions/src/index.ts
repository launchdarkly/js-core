import 'dotenv/config';

import { OpenAI } from 'openai';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';
import { getAIMetricsFromResponse } from '@launchdarkly/server-sdk-ai-openai';

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Set sdkKey to your LaunchDarkly SDK key.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set completionKey to the AI Config key you want to evaluate.
const completionKey = process.env.LAUNCHDARKLY_COMPLETION_KEY || 'sample-completion';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [new Observability({ serviceName: 'js-server-ai-example-openai-chat-completions' })],
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
    //   const aiConfig = await aiClient.completionConfig(completionKey, context, defaultValue, { myUserVariable: 'Testing Variable' });
    const aiConfig = await aiClient.completionConfig(completionKey, context, undefined, {
      myUserVariable: 'Testing Variable',
    });

    if (!aiConfig.enabled) {
      console.log(
        `AI config '${completionKey}' is disabled. Verify the config key exists in your LaunchDarkly project and is not targeting a disabled variation.`,
      );
      return;
    }

    const tracker = aiConfig.createTracker();

    const sampleQuestion = 'What can you help me with?';
    const messages = [
      ...(aiConfig.messages ?? []),
      { role: 'user' as const, content: sampleQuestion },
    ];

    console.log(`\nSending sample question to ${aiConfig.model?.name}: "${sampleQuestion}"`);
    console.log('Waiting for response...');

    const completion = await tracker.trackMetricsOf(getAIMetricsFromResponse, () =>
      openaiClient.chat.completions.create({
        messages,
        model: aiConfig.model?.name ?? 'gpt-4',
        temperature: (aiConfig.model?.parameters?.temperature as number) ?? 0.5,
        max_tokens: (aiConfig.model?.parameters?.maxTokens as number) ?? 4096,
      }),
    );
    const aiResponse = completion.choices[0]?.message.content ?? '';

    console.log(`\nModel response:\n${aiResponse}`);

    const summary = tracker.getSummary();
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
