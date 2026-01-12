# LaunchDarkly AI SDK for Server-Side JavaScript

[![NPM][server-ai-sdk-npm-badge]][server-ai-sdk-npm-link]
[![Actions Status][server-ai-sdk-ci-badge]][server-ai-sdk-ci]
[![Documentation][server-ai-sdk-ghp-badge]][server-ai-sdk-ghp-link]
[![NPM][server-ai-sdk-dm-badge]][server-ai-sdk-npm-link]
[![NPM][server-ai-sdk-dt-badge]][server-ai-sdk-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is a alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This assumes that you have already installed the LaunchDarkly Node.js (server-side) SDK, or a compatible edge SDK.

1. Install this package with `npm` or `yarn`:

```shell
npm install @launchdarkly/server-sdk-ai --save
# or
yarn add @launchdarkly/server-sdk-ai
```

2. Create an AI SDK instance:

```typescript
// The ldClient instance should be created based on the instructions in the relevant SDK.
const aiClient = initAi(ldClient);
```

## Setting Default AI Configurations

When retrieving AI configurations, you need to provide default values that will be used if the configuration is not available from LaunchDarkly:

### Fully Configured Default

```typescript
const defaultConfig = {
  enabled: true,
  model: { 
    name: 'gpt-4',
    parameters: { temperature: 0.7, maxTokens: 1000 }
  },
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' }
  ]
};
```

### Disabled Default

```typescript
const defaultConfig = {
  enabled: false
};
```

## Retrieving AI Configurations

The `completionConfig` method retrieves AI configurations from LaunchDarkly with support for dynamic variables and fallback values:

```typescript
const aiConfig = await aiClient.completionConfig(
  aiConfigKey,
  context,
  defaultConfig,
  { myVariable: 'My User Defined Variable' } // Variables for template interpolation
);

// Ensure configuration is enabled
if (aiConfig.enabled) {
  const { messages, model, tracker } = aiConfig;
  // Use with your AI provider
}
```

## TrackedChat for Conversational AI

`TrackedChat` provides a high-level interface for conversational AI with automatic conversation management and metrics tracking:

- Automatically configures models based on AI configuration
- Maintains conversation history across multiple interactions
- Automatically tracks token usage, latency, and success rates
- Works with any supported AI provider (see [AI Providers](https://github.com/launchdarkly/js-core#ai-providers) for available packages)

### Using TrackedChat

```typescript
// Use the same defaultConfig from the retrieval section above
const chat = await aiClient.createChat(
  'customer-support-chat',
  context,
  defaultConfig,
  { customerName: 'John' }
);

if (chat) {
  // Simple conversation flow - metrics are automatically tracked by invoke()
  const response1 = await chat.invoke('I need help with my order');
  console.log(response1.message.content);
  
  const response2 = await chat.invoke("What's the status?");
  console.log(response2.message.content);
  
  // Access conversation history
  const messages = chat.getMessages();
  console.log(`Conversation has ${messages.length} messages`);
}
```

## Advanced Usage with Providers

For more control, you can use the configuration directly with AI providers. We recommend using [LaunchDarkly AI Provider packages](https://github.com/launchdarkly/js-core#ai-providers) when available:

### Using AI Provider Packages

```typescript
import { LangChainProvider } from '@launchdarkly/server-sdk-ai-langchain';

const aiConfig = await aiClient.completionConfig(aiConfigKey, context, defaultValue);

// Create LangChain model from configuration
const llm = await LangChainProvider.createLangChainModel(aiConfig);

// Use with tracking
const response = await aiConfig.tracker.trackMetricsOf(
  LangChainProvider.getAIMetricsFromResponse,
  () => llm.invoke(messages)
);

console.log('AI Response:', response.content);
```

### Using Custom Providers

```typescript
import { LDAIMetrics } from '@launchdarkly/server-sdk-ai';

const aiConfig = await aiClient.completionConfig(aiConfigKey, context, defaultValue);

// Define custom metrics mapping for your provider
const mapCustomProviderMetrics = (response: any): LDAIMetrics => ({
  success: true,
  usage: {
    total: response.usage?.total_tokens || 0,
    input: response.usage?.prompt_tokens || 0,
    output: response.usage?.completion_tokens || 0,
  }
});

// Use with custom provider and tracking
const result = await aiConfig.tracker.trackMetricsOf(
  mapCustomProviderMetrics,
  () => customProvider.generate({
    messages: aiConfig.messages || [],
    model: aiConfig.model?.name || 'custom-model',
    temperature: aiConfig.model?.parameters?.temperature ?? 0.5,
  })
);

console.log('AI Response:', result.content);
```

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[server-ai-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml/badge.svg
[server-ai-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/server-ai.yml
[server-ai-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/server-sdk-ai.svg?style=flat-square
[server-ai-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/server-sdk-ai
[server-ai-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[server-ai-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/server-ai/docs/
[server-ai-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/server-sdk-ai.svg?style=flat-square
[server-ai-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/server-sdk-ai.svg?style=flat-square
