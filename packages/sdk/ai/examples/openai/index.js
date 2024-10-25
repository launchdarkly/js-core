const LaunchDarkly = require('@launchdarkly/node-server-sdk');
const LaunchDarklyAI = require('@launchdarkly/ai');
const { OpenAITokenUsage } = require('@launchdarkly/ai'); // Adjusted require
const OpenAI = require('openai');

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const ci = process.env.CI;

const client = new OpenAI({
	apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
      });
      
if (!sdkKey) {
    console.error("*** Please set the LAUNCHDARKLY_SDK_KEY env first");
    process.exit(1);
}
if (!aiConfigKey) {
    console.error("*** Please set the LAUNCHDARKLY_AI_CONFIG_KEY env first");
    process.exit(1);
}

const ldClient = LaunchDarkly.init(sdkKey);

// Set up the context properties. This context should appear on your LaunchDarkly contexts dashboard
// soon after you run the demo.
const context = {
	kind: 'user',
	key: 'example-user-key',
	name: 'Sandy',
      };

console.log("*** SDK successfully initialized");

async function main() {
	try {
		await ldClient.waitForInitialization({timeout: 10});
		const aiClient = LaunchDarklyAI.init(ldClient);

		const configValue = await aiClient.modelConfig(aiConfigKey, context, false, { myVariable: "My User Defined Variable" });
		const tracker = configValue.tracker;
		const completion = await tracker.trackOpenAI(async () => {
			return await client.chat.completions.create({
				messages: configValue.config.prompt,
				model: configValue.config.config.modelId,
			});
		});

		console.log("AI Response:", completion.choices[0].message.content);
		console.log("Success.");

	} catch (error) {
		console.log(`*** SDK failed to initialize: ${error}`);
		process.exit(1);
	}
    
}

main();