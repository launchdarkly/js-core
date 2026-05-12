# Tracked Chat Example

This example demonstrates how to use the LaunchDarkly AI SDK chat functionality with multiple providers for tracked chat interactions.

## Prerequisites

1. A LaunchDarkly account and SDK key
1. An OpenAI API key (for the AI provider)
1. Node.js 16 or later

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

1. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your keys:
   ```
   LAUNCHDARKLY_SDK_KEY=your-sdk-key-here
   OPENAI_API_KEY=your-openai-api-key-here
   LAUNCHDARKLY_AI_CONFIG_KEY=sample-ai-chat-config
   ```

1. Create an AI Config in LaunchDarkly:
   - Navigate to the AI Configs section in your LaunchDarkly dashboard
   - Create a new AI Config with the key `sample-ai-config`
   - Add a variation with the following settings:
     - **Model Selection**: Select "OpenAI" as the provider and "gpt-3.5-turbo" as the model
     - **Messages**: Add a system message with the content: "You are a helpful assistant for {{companyName}}. You should be friendly and informative."
     - Save the variation
   - Update the default target rule to use the newly created variation

## Running the Example

```bash
yarn start
```

This will:
1. Initialize the LaunchDarkly client
1. Create a chat configuration using the AI Config
1. Send a message to the AI and display the response
1. Automatically track interaction metrics (duration, tokens, success/error)
