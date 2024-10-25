const LaunchDarkly = require('@launchdarkly/node-server-sdk');
const LaunchDarklyAI = require('@launchdarkly/ai');
const { OpenAITokenUsage } = require('@launchdarkly/ai'); // Adjusted require
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
const aiConfigKey = process.env.LAUNCHDARKLY_AI_CONFIG_KEY || 'sample-ai-config';
const ci = process.env.CI;
const awsClient = new BedrockRuntimeClient({ region: "us-east-1" });

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
	let tracker;
	let configValue;
	try {
		await ldClient.waitForInitialization({timeout: 10});
		const aiClient = LaunchDarklyAI.init(ldClient);

		configValue = await aiClient.modelConfig(aiConfigKey, context, false, { myVariable: "My User Defined Variable" });
		tracker = configValue.tracker;
		

		

	} catch (error) {
		console.log(`*** SDK failed to initialize: ${error}`);
		process.exit(1);
	}
	const conversation = [
		{
		  role: "user",
		  content: [{ text: "Hello, how are you?" }],
		},
	      ];
	
	const completion = await tracker.trackBedrockConverse(await awsClient.send(
			new ConverseCommand({modelId: configValue.config.config.modelId, messages: mapPromptToConversation(configValue.config.prompt)})
	));
	console.log("AI Response:", completion.output.message.content[0].text);
	console.log("Success.");
}

function mapPromptToConversation(prompt) {
	return prompt.map(item => ({
	  role: item.role,
	  content: [{ text: item.content }]
	}));
      }

main();