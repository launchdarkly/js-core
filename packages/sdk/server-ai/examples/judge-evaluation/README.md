# LaunchDarkly AI SDK Judge Evaluation Example

This package demonstrates the integration of LaunchDarkly's AI SDK Judge functionality for evaluating AI responses using AI Configs with `mode: "judge"`.

## Installation and Build

When running as part of the js-core mono-repo the project will use local dependencies.
As such those dependencies need built.

In the root of the repository run:

```bash
yarn
```

And then

```bash
yarn build
```

## AI Config Setup

Make sure you have an AI Config configured in LaunchDarkly with `mode: "judge"`:

1. Create an AI Config in LaunchDarkly:
   - Navigate to the AI Configs section in your LaunchDarkly dashboard
   - Create a new AI Config in Completion mode with the key `sample-ai-config`
   - Add a variation with the following settings:
     - **Model Selection**: Select "OpenAI" as the provider and "gpt-3.5-turbo" as the model
     - **Messages**: Add a system message with the content: "You are a helpful assistant for {{companyName}}. You should be friendly and informative."
     - Save the variation
   - Update the default target rule to use the newly created variation
   - Attach one or more judges to your config

## Configuration

Before running the example, make sure to set the following environment variables:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set the following environment variables:
   - `LAUNCHDARKLY_SDK_KEY`: Your LaunchDarkly SDK key (required)
   - `LAUNCHDARKLY_AI_CONFIG_KEY`: Your AI Config key (defaults to 'sample-ai-config')
   - `LAUNCHDARKLY_JUDGE_KEY`: Your judge AI Config key (defaults to 'ld-ai-judge-accuracy')
   - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI provider)

## Usage

The main script (`index.js`) demonstrates how to:

1. Initialize the LaunchDarkly SDK
1. Set up a user context
1. Initialize the LaunchDarkly AI client
1. Create a chat for an AI Config with attached judges
1. Create a judge for direct evaluation
1. Evaluate AI text using the `evaluate()` method
1. Handle evaluation results and errors

To run the example (in the judge-evaluation directory):

```bash
yarn start
```

## Note

This example uses the Judge functionality to evaluate AI responses. Make sure your LaunchDarkly AI Configs are set up correctly with `mode: "judge"` and include the necessary evaluation prompts and metrics.
