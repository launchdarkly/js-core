# LaunchDarkly AI SDK OpenAI Provider for Server-Side JavaScript

[![NPM][server-ai-openai-npm-badge]][server-ai-openai-npm-link]
[![Actions Status][server-ai-openai-ci-badge]][server-ai-openai-ci]
[![Documentation][server-ai-openai-ghp-badge]][server-ai-openai-ghp-link]
[![NPM][server-ai-openai-dm-badge]][server-ai-openai-npm-link]
[![NPM][server-ai-openai-dt-badge]][server-ai-openai-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

> [!NOTE]
> This provider currently uses OpenAI's completion API. We plan to migrate to the responses API in a future release to take advantage of improved functionality and performance.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This package provides OpenAI integration for the LaunchDarkly AI SDK. The simplest way to use it is with the LaunchDarkly AI SDK's `initChat` method:

1. Install the required packages:

```shell
npm install @launchdarkly/server-sdk-ai @launchdarkly/server-sdk-ai-openai --save
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
  const response = await chat.invoke("What is the capital of France?");
  console.log(response.message.content);
}
```

For more information about using the LaunchDarkly AI SDK, see the [LaunchDarkly AI SDK documentation](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai/README.md).

## Advanced Usage

For more control, you can use the OpenAI provider package directly with LaunchDarkly configurations:

```typescript
import { OpenAIProvider } from '@launchdarkly/server-sdk-ai-openai';
import { OpenAI } from 'openai';

// Create an OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Combine LaunchDarkly AI Config messages with user message
const configMessages = aiConfig.messages || [];
const userMessage = { role: 'user', content: 'What is the capital of France?' };
const allMessages = [...configMessages, userMessage];

// Track the model call with LaunchDarkly tracking
const response = await aiConfig.tracker.trackMetricsOf(
  OpenAIProvider.getAIMetricsFromResponse,
  () => client.chat.completions.create({
    model: 'gpt-4',
    messages: allMessages,
    temperature: 0.7,
  })
);

console.log('AI Response:', response.choices[0].message.content);
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

[server-ai-openai-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-openai.yml/badge.svg
[server-ai-openai-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai-openai.yml
[server-ai-openai-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai-openai.svg?style=flat-square
[server-ai-openai-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai-openai
[server-ai-openai-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[server-ai-openai-ghp-link]: https://launchdarkly.github.io/js-core/packages/ai-providers/server-ai-openai/docs/
[server-ai-openai-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai-openai.svg?style=flat-square
[server-ai-openai-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai-openai.svg?style=flat-square
