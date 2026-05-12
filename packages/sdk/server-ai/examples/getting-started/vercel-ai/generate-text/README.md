# Vercel AI generateText Example

This example demonstrates how to use LaunchDarkly's AI Config with the [Vercel AI SDK](https://sdk.vercel.ai/) `generateText` API. The example uses the OpenAI provider but the same pattern applies to any Vercel AI provider.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-completion`. Select OpenAI as the provider, a model such as `gpt-4`, and add a system message.
2. Set the required environment variables:
   ```
   export LAUNCHDARKLY_SDK_KEY=...
   export OPENAI_API_KEY=...
   ```
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace vercel-ai-generate-text bootstrap
   ```

## Run

```
yarn workspace vercel-ai-generate-text start
```
