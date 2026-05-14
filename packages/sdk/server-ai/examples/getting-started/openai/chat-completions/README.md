# OpenAI Chat Completions Example

This example demonstrates how to use LaunchDarkly's AI Config with the OpenAI Chat Completions API.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-completion`. Select OpenAI as the provider, a model such as `gpt-4`, and add a system message.
2. Copy `.env.example` to `.env` and fill in your keys:
   ```
   cp .env.example .env
   ```
   Then edit `.env` to add your `LAUNCHDARKLY_SDK_KEY` and any provider keys.
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace openai-chat-completions bootstrap
   ```

## Run

```
yarn workspace openai-chat-completions start
```
