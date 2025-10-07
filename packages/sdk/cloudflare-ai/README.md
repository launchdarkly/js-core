# LaunchDarkly AI SDK for Cloudflare Workers

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is an alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

## Prerequisites

### Required: LaunchDarkly Cloudflare KV Integration

**This SDK requires the [LaunchDarkly Cloudflare KV integration](https://docs.launchdarkly.com/integrations/cloudflare) to be enabled.** The integration automatically syncs your feature flag data to Cloudflare KV storage, which the SDK then reads for fast, edge-based flag evaluation.

To enable the integration:
1. Go to [LaunchDarkly Integrations](https://app.launchdarkly.com/settings/integrations)
2. Find and enable the **Cloudflare KV** integration
3. Connect it to your Cloudflare account and KV namespace
4. Select the LaunchDarkly environment you want to sync

Once enabled, your flags will automatically sync to Cloudflare KV within seconds of any changes.

## Install

Install the AI SDK alongside the Cloudflare server SDK:

```bash
# npm
npm i @launchdarkly/cloudflare-server-sdk @launchdarkly/cloudflare-server-sdk-ai

# yarn
yarn add @launchdarkly/cloudflare-server-sdk @launchdarkly/cloudflare-server-sdk-ai
```

Then enable the Node.js compatibility flag and bind Workers AI in your `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"
```

## Quick Setup

This assumes that you have already installed the LaunchDarkly Cloudflare server SDK and enabled the Cloudflare KV integration.

1. Install this package with `npm`:

```bash
npm install @launchdarkly/cloudflare-server-sdk-ai
```

2. Create an AI SDK instance:

```typescript
// The ldClient instance should be created based on the instructions in the Cloudflare SDK.
// If available, pass your client-side ID and KV namespace so the AI SDK
// can read AI Configs directly from Cloudflare KV.
const aiClient = initAi(ldClient, env.LD_CLIENT_ID, env.LD_KV);
```

3. Evaluate a model configuration:

```typescript
const config = await aiClient.config(
  'my-ai-config',
  { kind: 'user', key: 'user-123' },
  { enabled: false },
  { username: 'Alice' }
);
```

For a complete working example, please refer to the example folder.

## Features

- **AI Configuration Management**: Manage AI model configurations through LaunchDarkly
- **Dynamic Model Selection**: Choose models based on user context and targeting rules
- **Template-based Prompts**: Use variable interpolation in prompts with Mustache templates
- **Comprehensive Metrics**: Track success, duration, token usage, and user feedback
- **Cloudflare Workers AI Integration**: Seamless mapping to Cloudflare Workers AI format
- **Full TypeScript Support**: Complete type definitions for all APIs

## Usage Example

```typescript
import { init } from '@launchdarkly/cloudflare-server-sdk';
import { initAi } from '@launchdarkly/cloudflare-server-sdk-ai';

export default {
  async fetch(request, env, ctx) {
    // Initialize the base LaunchDarkly client
    const ldClient = init(env.LD_CLIENT_ID, env.LD_KV, { sendEvents: true });
    await ldClient.waitForInitialization();

    // Initialize the AI client with optional KV access
    const aiClient = initAi(ldClient, env.LD_CLIENT_ID, env.LD_KV);

    // Get AI configuration
    const config = await aiClient.config(
      'my-ai-config',
      { kind: 'user', key: 'user-123' },
      { enabled: false },
      { username: 'Alice' }
    );

    if (config.enabled) {
      // Run the AI model and automatically record metrics
      const response = await config.runWithWorkersAI(env.AI);

      // Ensure events are flushed after respond
      ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()));

      return Response.json(response);
    }

    return new Response('AI disabled', { status: 503 });
  }
};
```

## Supported Models

Use the full Cloudflare Workers AI model IDs in your LaunchDarkly AI configurations. Examples:

- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/meta/llama-3.1-70b-instruct`
- `@cf/meta/llama-3.1-8b-instruct-fast`
- `@cf/openai/gpt-oss-120b`
- `@cf/mistralai/mistral-7b-instruct-v0.1`
- `@cf/qwen/qwq-32b`
- `@cf/google/gemma-3-12b-it`

For a complete list of available models, see the [Cloudflare Workers AI Models documentation](https://developers.cloudflare.com/workers-ai/models/).

## Configuration

### LaunchDarkly Dashboard

Create an AI Config in your LaunchDarkly dashboard:

```json
{
  "model": {
    "name": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "parameters": {
      "temperature": 0.7,
      "max_tokens": 1000
    }
  },
  "provider": {
    "name": "cloudflare-workers-ai"
  },
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant for {{company}}."
    },
    {
      "role": "user",
      "content": "{{userQuery}}"
    }
  ]
}
```

### Variable Interpolation

Pass variables to customize prompts:

```typescript
const config = await aiClient.config(
  'chat-config',
  context,
  defaultValue,
  {
    company: 'Acme Corp',
    userQuery: 'How do I reset my password?'
  }
);
```

## API Reference

### `initAi(ldClient)`

Initializes the AI client.

**Parameters:**
- `ldClient`: LaunchDarkly Cloudflare client instance

**Returns:** `LDAIClient`

### `aiClient.config(key, context, defaultValue, variables)`

Retrieves an AI configuration from LaunchDarkly.

**Parameters:**
- `key`: Configuration key in LaunchDarkly
- `context`: LaunchDarkly context for evaluation
- `defaultValue`: Fallback configuration
- `variables`: Optional variables for prompt interpolation

**Returns:** `Promise<LDAIConfig>`

### `config.toCloudflareWorkersAI(options)`

Converts the configuration to Cloudflare Workers AI format.

**Parameters:**
- `options`: Optional conversion options
  - `modelOverride`: Override the model
  - `stream`: Enable streaming
  - `additionalParams`: Additional parameters

**Returns:** `CloudflareAIConfig`

### `config.runWithWorkersAI(aiBinding, options)`

Runs the model via the Workers AI binding and automatically records metrics.

**Parameters:**
- `aiBinding`: Cloudflare Workers AI binding (for example, `env.AI`)
- `options`: Optional conversion options (same as `toCloudflareWorkersAI`)

**Returns:** Provider-specific response from Workers AI

### Metrics Tracking

```typescript
config.tracker.trackSuccess();
config.tracker.trackDuration(durationMs);
config.tracker.trackMetrics({
  durationMs: 150,
  success: true,
  usage: {
    inputTokens: 50,
    outputTokens: 100,
    totalTokens: 150
  }
});
config.tracker.trackFeedback('positive');
```

Note: `runWithWorkersAI` automatically records duration and token usage when possible.

## Advanced Usage

### Dynamic Model Selection

Use LaunchDarkly targeting rules to serve different models based on user attributes:

```typescript
const config = await aiClient.config(
  'adaptive-model',
  {
    kind: 'user',
    key: userId,
    tier: 'premium'
  },
  defaultValue
);
```

### A/B Testing

Compare different models or prompts:

```typescript
const config = await aiClient.config('ab-test-config', context, defaultValue);

const cfConfig = config.toCloudflareWorkersAI();
const response = await env.AI.run(cfConfig.model, cfConfig);

config.tracker.trackMetrics({
  durationMs: duration,
  success: true,
  usage: response.usage
});
```

### Streaming Responses

```typescript
const cfConfig = config.toCloudflareWorkersAI({ stream: true });
const stream = await env.AI.run(cfConfig.model, cfConfig);
```

## Examples

See the `example/` directory for a complete working example with setup instructions.

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

