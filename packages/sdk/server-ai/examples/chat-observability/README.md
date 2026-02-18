# Chat with Observability Example

This example demonstrates how to use the LaunchDarkly AI SDK chat with the LaunchDarkly observability plugin and OpenLLMetry for Node.js. The observability plugin captures and sends SDK operations, flag evaluations, error monitoring, logging, and distributed tracing to LaunchDarkly. OpenLLMetry (via `@traceloop/instrumentation-openai`) instruments the OpenAI provider so LLM spans are correctly tagged with model, prompts, token usage, and latency in LaunchDarkly's Traces view.

Initialization order follows [LLM observability docs](https://launchdarkly.com/docs/home/observability/llm-observability): LaunchDarkly SDK is initialized first, then OpenLLMetry instrumentations are registered, and only then is the chat code (which loads the OpenAI client) run.

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

View your data in the LaunchDarkly dashboard under **Observability** (SDK operations, flag evaluations, errors, logs, and traces). LLM requests appear as spans marked with a green LLM symbol in **Monitor → Traces**; select a span to see model name, prompt/response, token counts, and latency.
