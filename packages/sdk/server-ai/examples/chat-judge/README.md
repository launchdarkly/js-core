# LaunchDarkly AI SDK Chat Judge Example

This example demonstrates how to use the LaunchDarkly AI SDK's chat functionality with automatic judge evaluation. When judges are attached to an AI Config, the `invoke()` method automatically evaluates the chat response.

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

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set the following environment variables:
   - `LAUNCHDARKLY_SDK_KEY`: Your LaunchDarkly SDK key (required)
   - `LAUNCHDARKLY_AI_CONFIG_KEY`: Your AI Config key (defaults to 'sample-ai-config')
   - `OPENAI_API_KEY`: Your OpenAI API key (required if using OpenAI provider)

## Usage

To run the example (in the chat-judge directory):

```bash
yarn start
```

This will:
1. Initialize the LaunchDarkly SDK and AI client
2. Create a chat for an AI Config with attached judges
3. Send a message and receive a response
4. Automatically evaluate the response using configured judges
5. Display the judge evaluation results
