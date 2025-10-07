# LaunchDarkly AI SDK for Cloudflare Workers

[![NPM][cf-ai-sdk-npm-badge]][cf-ai-sdk-npm-link]
[![Actions Status][cf-ai-sdk-ci-badge]][cf-ai-sdk-ci]
[![Documentation][cf-ai-sdk-ghp-badge]][cf-ai-sdk-ghp-link]
[![NPM][cf-ai-sdk-dm-badge]][cf-ai-sdk-npm-link]
[![NPM][cf-ai-sdk-dt-badge]][cf-ai-sdk-npm-link]

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is an alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick Setup

This assumes that you have already installed the LaunchDarkly Cloudflare server SDK and enabled the Cloudflare KV integration.

1. Install this package with `npm` or `yarn`:

```shell
npm install @launchdarkly/cloudflare-server-sdk-ai --save
```

2. Ensure Workers AI is bound and Node.js compatibility is enabled in `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"
```

3. Create an AI SDK instance and evaluate a model configuration:

```typescript
import { init } from '@launchdarkly/cloudflare-server-sdk';
import { initAi } from '@launchdarkly/cloudflare-server-sdk-ai';

export default {
  async fetch(request, env, ctx) {
    // Initialize the base LaunchDarkly client
    const ldClient = init(env.LD_CLIENT_ID, env.LD_KV, { sendEvents: true });
    await ldClient.waitForInitialization();

    // Initialize the AI client (pass options to enable KV fast‑path)
    const aiClient = initAi(ldClient, { clientSideID: env.LD_CLIENT_ID, kvNamespace: env.LD_KV });

    // Set up the context properties
    const context = {
      kind: 'user',
      key: 'example-user-key',
      name: 'Sandy',
    };

    // Get AI configuration
    const aiConfig = await aiClient.config(
      'my-ai-config',
      context,
      {
        model: {
          name: 'my-default-model',
        },
        enabled: true,
      },
      {
        myVariable: 'My User Defined Variable',
      },
    );
    const { tracker } = aiConfig;

    if (aiConfig.enabled) {
      // Map to Workers AI and run
      const wc = aiConfig.toWorkersAI(env.AI);
      const response = await env.AI.run(wc.model, wc);

      // Ensure events are flushed after respond
      ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()));

      return Response.json(response);
    }

    return new Response('AI disabled', { status: 503 });
  }
};
```

For a complete working example, see the `example/` directory.

## API Reference

### `initAi(ldClient, options?)`

Initializes the AI client.

**Parameters:**
- `ldClient`: LaunchDarkly Cloudflare client instance
- `options` (optional): `{ clientSideID?: string; kvNamespace?: KVNamespace }`
  - If both `clientSideID` and `kvNamespace` are provided, the KV fast‑path is enabled.

**Returns:** `LDAIClient`

### `aiClient.config(key, context, defaultValue, variables?)`

Retrieves an AI configuration from LaunchDarkly.

**Parameters:**
- `key`: Configuration key in LaunchDarkly
- `context`: LaunchDarkly context for evaluation
- `defaultValue`: Fallback configuration used only if evaluation data is unavailable
- `variables` (optional): Variables for Mustache interpolation in `messages[].content`

**Returns:** `Promise<LDAIConfig>`

### `aiClient.agent(key, context, defaultValue, variables?)`

Evaluates an AI Agent and returns interpolated `instructions` plus tracker and optional model/provider.

**Parameters:** same shape as `config`, with `defaultValue` of type `LDAIAgentDefaults`.

**Returns:** `Promise<LDAIAgent>`

### `aiClient.agents(agentConfigs, context)`

Evaluates multiple agents and returns a map of key to `LDAIAgent`.

### `config.toWorkersAI(binding, options)`

Converts the configuration to Cloudflare Workers AI format.

**Parameters:**
- `binding`: Workers AI binding (`env.AI`)
- `options` (optional):
  - `modelOverride`: Override the model
  - `stream`: Enable streaming
  - `additionalParams`: Additional parameters

**Returns:** `WorkersAIConfig`

<!-- Optional convenience runner removed; call env.AI.run directly -->

### Metrics Tracking

```typescript
config.tracker.trackSuccess();
config.tracker.trackDuration(durationMs);
config.tracker.trackMetrics({
  durationMs: 150,
  success: true,
  usage: {
    input: 50,
    output: 100,
    total: 150
  }
});
config.tracker.trackFeedback('positive');
```

Workers AI helpers:

```typescript
// Non-streaming
const result = await config.tracker.trackWorkersAIMetrics(async () => env.AI.run(wc.model, wc));

// Streaming
const stream = config.tracker.trackWorkersAIStreamMetrics(() => env.AI.run(wc.model, { ...wc, stream: true }));
```

Token usage normalization: Workers AI responses might include either `{ usage: { prompt_tokens, completion_tokens, total_tokens } }` or `{ usage: { input_tokens, output_tokens, total_tokens } }`. The SDK maps both to `{ input, output, total }`.

## Supported Models

Use full Workers AI model IDs in your LaunchDarkly AI configurations, for example:

- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/openai/gpt-oss-120b`
- `@cf/mistralai/mistral-7b-instruct-v0.1`

See the Workers AI model catalog for more options: [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/).

## Roles and messages

Supported roles in `messages` are `system`, `user`, and `assistant`. Example:

```typescript
const config = await aiClient.config('welcome_prompt', ctx, { enabled: true, model: { name: '@cf/meta/llama-3-8b-instruct' } }, {
  username: 'Sandy',
});

// Messages are interpolated with Mustache
// e.g., "Hello {{username}}" -> "Hello Sandy"
const wc = config.toWorkersAI(env.AI);
const res = await env.AI.run(wc.model, wc);
```

## Agents API

```typescript
const research = await aiClient.agent('research_agent', ctx, { enabled: true, instructions: 'You are a research assistant for {{topic}}.' }, { topic: 'climate change' });

if (research.enabled) {
  const wc = research.toWorkersAI(env.AI);
  const res = await env.AI.run(wc.model, wc);
  research.tracker.trackSuccess();
}

const agents = await aiClient.agents([
  { key: 'research_agent', defaultValue: { enabled: true, instructions: 'You are a research assistant.' }, variables: { topic: 'climate change' } },
  { key: 'writing_agent', defaultValue: { enabled: true, instructions: 'You are a writing assistant.' }, variables: { style: 'academic' } },
] as const, ctx);
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

[cf-ai-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/cloudflare-ai.yml/badge.svg
[cf-ai-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/cloudflare-ai.yml
[cf-ai-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/cloudflare-server-sdk-ai.svg?style=flat-square
[cf-ai-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/cloudflare-server-sdk-ai
[cf-ai-sdk-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[cf-ai-sdk-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/cloudflare-ai/docs/
[cf-ai-sdk-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/cloudflare-server-sdk-ai.svg?style=flat-square
[cf-ai-sdk-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/cloudflare-server-sdk-ai.svg?style=flat-square

