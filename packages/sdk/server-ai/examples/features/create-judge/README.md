# Create Judge Example

This example demonstrates how to use LaunchDarkly's `createJudge` method to evaluate arbitrary input/output text pairs against a Judge AI Config.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- A provider API key for whichever model the Judge AI Config selects (e.g. `OPENAI_API_KEY`)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-judge`, in Judge mode. Configure a provider, model, and judge criteria messages.
2. Set the required environment variables:
   ```
   export LAUNCHDARKLY_SDK_KEY=...
   export OPENAI_API_KEY=...   # if your AI Config uses OpenAI
   ```
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace create-judge bootstrap
   ```

## Run

```
yarn workspace create-judge start
```
