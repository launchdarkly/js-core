# Create Agent Example

This example demonstrates how to use LaunchDarkly's `createAgent` method, which handles agent invocation, automatic metrics tracking, and optional judge evaluation in a single managed call.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- A provider API key for whichever model your AI Config selects (e.g. `OPENAI_API_KEY`)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-agent`, in Agent mode. Configure a provider, model, and instructions.
2. Set the required environment variables:
   ```
   export LAUNCHDARKLY_SDK_KEY=...
   export OPENAI_API_KEY=...   # if your AI Config uses OpenAI
   ```
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace create-agent bootstrap
   ```

## Run

```
yarn workspace create-agent start
```
