# Chat with Observability Example

This example demonstrates how to use the LaunchDarkly AI SDK chat with the LaunchDarkly observability plugin for Node.js. The observability plugin captures and sends SDK operations, flag evaluations, error monitoring, logging, and distributed tracing to LaunchDarkly.

## Prerequisites

1. A LaunchDarkly account and SDK key
2. Node.js 16 or later
3. Node server SDK v9.10 or later (required for the observability plugin)
4. An OpenAI API key if your AI Config uses OpenAI

## Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your keys.

3. Create an AI Config in LaunchDarkly (e.g. key `sample-ai-config`) with a chat-enabled variation and the provider/model you want to use.

## Running the Example

```bash
yarn start
```

This will initialize the LaunchDarkly client with the observability plugin, create a chat from your AI Config, send two example messages, and stream the responses. Observability data is sent automatically to LaunchDarkly.

View your data in the LaunchDarkly dashboard under **Observability** (SDK operations, flag evaluations, errors, logs, and traces).
