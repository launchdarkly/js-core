# Create Model Example

This example demonstrates how to use LaunchDarkly's `createModel` method, which handles model creation, chat execution, automatic metrics tracking, and optional judge evaluation in a single managed call.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- A provider API key for whichever model your AI Config selects (e.g. `OPENAI_API_KEY`)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-completion`. Configure a provider, model, and at least one message.
2. Copy `.env.example` to `.env` and fill in your keys:
   ```
   cp .env.example .env
   ```
   Then edit `.env` to add your `LAUNCHDARKLY_SDK_KEY` and any provider keys.
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace create-model bootstrap
   ```

## Run

```
yarn workspace create-model start
```

## Adding judges

Judge evaluations are dispatched automatically by `createModel` when the AI Config has judges configured. To see judge output, add one or more judges to the `sample-completion` AI Config in the LaunchDarkly UI -- the example already awaits `result.evaluations` and prints each judge's result.
