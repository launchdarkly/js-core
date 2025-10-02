# LangChain Chat Example

This example demonstrates how to use the LaunchDarkly AI SDK with LangChain for chat interactions.

## Prerequisites

1. A LaunchDarkly account and SDK key
2. An OpenAI API key (for the LangChain integration)
3. Node.js 16 or later

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your keys:
   ```
   LAUNCHDARKLY_SDK_KEY=your-sdk-key-here
   OPENAI_API_KEY=your-openai-api-key-here
   LAUNCHDARKLY_AI_CONFIG_KEY=sample-ai-chat-config
   ```

3. Create an AI Config in LaunchDarkly with the key `sample-ai-config`:
   ```json
   {
     "_ldMeta": {
       "variationKey": "1234",
       "enabled": true,
       "version": 1
     },
     "messages": [
       {
         "content": "You are a helpful assistant for {{customerName}}. You should be friendly and informative.",
         "role": "system"
       }
     ],
     "model": {
       "name": "gpt-3.5-turbo",
       "parameters": {
         "temperature": 0.7,
         "maxTokens": 1000
       }
     },
     "provider": {
       "name": "langchain"
     }
   }
   ```

## Running the Example

```bash
yarn start
```

This will:
1. Initialize the LaunchDarkly client
2. Create a chat configuration using the AI Config
3. Send a message to the AI and display the response
4. Continue the conversation with a follow-up question
5. Automatically track interaction metrics (duration, tokens, success/error)

## Features Demonstrated

- **AI Config Integration**: Using LaunchDarkly to configure AI models and prompts
- **Variable Interpolation**: Using Mustache templates with runtime variables
- **Chat Conversations**: Multi-turn conversations with message history
- **Provider Integration**: Using LangChain as the AI provider
- **Metrics Tracking**: Automatic tracking of token usage and performance
