# AWS Bedrock Converse Example

This example demonstrates how to use LaunchDarkly's AI Config with the AWS Bedrock Converse API.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key
- AWS credentials configured for Bedrock access (e.g. via `AWS_PROFILE` or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`)

## Setup

1. [Create an AI Config](https://launchdarkly.com/docs/home/ai-configs/create) in LaunchDarkly with the key `sample-completion`. Select a Bedrock model (e.g. `anthropic.claude-3-haiku-20240307-v1:0`) and add a system message.
2. Copy `.env.example` to `.env` and fill in your keys:
   ```
   cp .env.example .env
   ```
   Then edit `.env` to add your `LAUNCHDARKLY_SDK_KEY` and any provider keys. AWS credentials should be configured via your usual mechanism (`AWS_PROFILE`, IAM role, etc.).
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace bedrock-converse bootstrap
   ```

## Run

```
yarn workspace bedrock-converse start
```
