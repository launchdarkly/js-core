# Provider-Specific Observability Example (OpenAI)

This example shows how to use the LaunchDarkly observability plugin when calling an AI provider directly — without the higher-level `createChat` abstraction. It uses OpenAI as the provider, but the same pattern applies to any provider (Bedrock, Anthropic, Vercel AI SDK, etc.).

## How it works

1. **Initialize the LaunchDarkly client** with the `Observability` plugin — this enables automatic capture of SDK operations, flag evaluations, errors, logs, and distributed traces.
2. **Get the AI Config** via `completionConfig()` — this returns the model, messages, and parameters configured in LaunchDarkly, along with a `tracker` for reporting metrics.
3. **Call your provider directly** and wrap it with the tracker — the tracker records latency, token usage, and success/error status.

The tracker provides several methods depending on your provider. This example uses `trackMetricsOf` with the LaunchDarkly OpenAI provider's `getAIMetricsFromResponse` extractor:

| Method | Provider |
|--------|----------|
| `tracker.trackMetricsOf(OpenAIProvider.getAIMetricsFromResponse, fn)` | OpenAI (recommended) |
| `tracker.trackBedrockConverseMetrics(response)` | AWS Bedrock |
| `tracker.trackVercelAISDKGenerateTextMetrics(fn)` | Vercel AI SDK |
| `tracker.trackMetricsOf(extractor, fn)` | Any provider (custom extractor) |

## Prerequisites

1. A LaunchDarkly account and SDK key
2. Node.js 16 or later
3. Node server SDK v9.10 or later (required for the observability plugin)
4. An OpenAI API key

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

3. Create an AI Config in LaunchDarkly (e.g. key `sample-ai-config`) with a completion-enabled variation and the model you want to use.

## Running the Example

```bash
yarn start
```

This will:
- Initialize the LaunchDarkly client with the observability plugin
- Retrieve the AI Config (model, messages, parameters) from LaunchDarkly
- Call OpenAI directly using your own client
- Automatically track latency, token usage, and success/error via the tracker

View your data in the LaunchDarkly dashboard under **Observability**.

## Adapting for other providers

To use a different provider, replace the OpenAI-specific parts:

1. Swap the OpenAI client for your provider's client
2. Use the appropriate tracker method (see table above), or use `trackMetricsOf` with a custom metrics extractor
3. Map `aiConfig.messages` and `aiConfig.model` to your provider's API format

See the [bedrock](../bedrock/) example for an AWS Bedrock adaptation.
