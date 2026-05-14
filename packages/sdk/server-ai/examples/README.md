# LaunchDarkly AI SDK for JavaScript - Examples

| Package | npm | Docs |
| --- | --- | --- |
| [@launchdarkly/server-sdk-ai](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai) | [![npm](https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai)](https://www.npmjs.com/package/@launchdarkly/server-sdk-ai) | [Reference](https://docs.launchdarkly.com/sdk/ai/nodejs) |
| [@launchdarkly/server-sdk-ai-openai](https://github.com/launchdarkly/js-core/tree/main/packages/ai-providers/server-ai-openai) | [![npm](https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai-openai)](https://www.npmjs.com/package/@launchdarkly/server-sdk-ai-openai) | [Reference](https://docs.launchdarkly.com/sdk/ai/nodejs) |
| [@launchdarkly/server-sdk-ai-vercel](https://github.com/launchdarkly/js-core/tree/main/packages/ai-providers/server-ai-vercel) | [![npm](https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai-vercel)](https://www.npmjs.com/package/@launchdarkly/server-sdk-ai-vercel) | [Reference](https://docs.launchdarkly.com/sdk/ai/nodejs) |
| [@launchdarkly/observability-node](https://www.npmjs.com/package/@launchdarkly/observability-node) | [![npm](https://img.shields.io/npm/v/@launchdarkly/observability-node)](https://www.npmjs.com/package/@launchdarkly/observability-node) | [Reference](https://docs.launchdarkly.com/sdk/observability/nodejs) |

Each example is a self-contained application you can run independently to explore LaunchDarkly's AI APIs hands-on. Pick one that matches your provider or use case, follow the README, and you'll be up and running in minutes.

For more comprehensive instructions, visit the [Quickstart page](https://docs.launchdarkly.com/home/ai-configs/quickstart) or the [Node.js reference guide](https://docs.launchdarkly.com/sdk/ai/nodejs).

## Getting Started

These examples show how to integrate LaunchDarkly AI with different providers.

| Provider | Example | Description |
| --- | --- | --- |
| Bedrock | [Converse](getting-started/bedrock/converse/) | `completionConfig` with AWS Bedrock Converse API, metrics tracking |
| OpenAI | [Chat Completions](getting-started/openai/chat-completions/) | `completionConfig` with OpenAI, automatic metrics tracking |
| Vercel AI | [generateText](getting-started/vercel-ai/generate-text/) | `completionConfig` with the Vercel AI SDK, metrics tracking |

## Features

These examples demonstrate LaunchDarkly's managed APIs and standalone capabilities.

| Example | Description |
| --- | --- |
| [createModel](features/create-model/) | Managed chat, automatic metrics tracking, and judge evaluation |
| [createAgent](features/create-agent/) | Managed agent, automatic metrics tracking, and judge evaluation |
| [createAgentGraph](features/create-agent-graph/) | Multi-node agent graph traversal and tracking |
| [createJudge](features/create-judge/) | Standalone evaluation of AI responses |
