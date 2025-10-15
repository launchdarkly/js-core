# LaunchDarkly AI SDK LangChain Provider for Server-Side JavaScript

[![NPM][server-ai-langchain-npm-badge]][server-ai-langchain-npm-link]
[![Actions Status][server-ai-langchain-ci-badge]][server-ai-langchain-ci]
[![Documentation][server-ai-langchain-ghp-badge]][server-ai-langchain-ghp-link]
[![NPM][server-ai-langchain-dm-badge]][server-ai-langchain-npm-link]
[![NPM][server-ai-langchain-dt-badge]][server-ai-langchain-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This package provides LangChain integration for the LaunchDarkly AI SDK. The simplest way to use it is with the LaunchDarkly AI SDK's `initChat` method:

1. Install the required packages:

```shell
npm install @launchdarkly/server-sdk-ai @launchdarkly/server-sdk-ai-langchain --save
# or
yarn add @launchdarkly/server-sdk-ai @launchdarkly/server-sdk-ai-langchain
```

2. Create a chat session and use it:

```typescript
import { init } from '@launchdarkly/node-server-sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';

// Initialize LaunchDarkly client
const ldClient = init(sdkKey);
const aiClient = initAi(ldClient);

// Create a chat session
const defaultConfig = { 
  enabled: true, 
  model: { name: 'gpt-4' },
  provider: { name: 'openai' }
};
const chat = await aiClient.initChat('my-chat-config', context, defaultConfig);

if (chat) {
  const response = await chat.invoke('What is the capital of France?');
  console.log(response.message.content);
}
```

For more information about using the LaunchDarkly AI SDK, see the [LaunchDarkly AI SDK documentation](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai/README.md).

## Langchain Provider Installation

> **Important**: You will need to install additional provider packages for the specific AI models you want to use. LangChain requires separate packages for each provider.

When creating a new LangChain model, LaunchDarkly uses an AI Config and the `initChatModel` provided by LangChain to create a model instance. You should install all LangChain providers for each provider you plan to use in your AI Config to ensure they can be properly instantiated.

### Installing a LangChain Provider

To use specific AI models, install the corresponding provider package:

```shell
# For OpenAI models
npm install @langchain/openai --save
# or
yarn add @langchain/openai
```

For a complete list of available providers and installation instructions, see the [LangChain JavaScript Integrations documentation](https://js.langchain.com/docs/integrations/chat/).

## Advanced Usage

For more control, you can use the LangChain provider package directly with LaunchDarkly configurations:

```typescript
import { LangChainProvider } from '@launchdarkly/server-sdk-ai-langchain';
import { HumanMessage } from '@langchain/core/messages';

// Create a LangChain model from LaunchDarkly configuration
const llm = await LangChainProvider.createLangChainModel(aiConfig);

// Convert LaunchDarkly messages to LangChain format and add user message
const configMessages = aiConfig.messages || [];
const userMessage = new HumanMessage('What is the capital of France?');
const allMessages = [...LangChainProvider.convertMessagesToLangChain(configMessages), userMessage];

// Track the model call with LaunchDarkly tracking
const response = await aiConfig.tracker.trackMetricsOf(
  (result) => LangChainProvider.createAIMetrics(result),
  () => llm.invoke(allMessages)
);

console.log('AI Response:', response.content);
```


## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[server-ai-langchain-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-langchain.yml/badge.svg
[server-ai-langchain-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-langchain.yml
[server-ai-langchain-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai-langchain.svg?style=flat-square
[server-ai-langchain-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai-langchain
[server-ai-langchain-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[server-ai-langchain-ghp-link]: https://launchdarkly.github.io/js-core/packages/ai-providers/server-ai-langchain/docs/
[server-ai-langchain-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai-langchain.svg?style=flat-square
[server-ai-langchain-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai-langchain.svg?style=flat-square
