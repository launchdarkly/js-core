# LaunchDarkly AI SDK for Cloudflare Workers

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This library is an alpha version and should not be considered ready for production use while this message is visible.

# ☝️☝️☝️☝️☝️☝️

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Quick start

Assumes you’ve installed the LaunchDarkly Cloudflare server SDK and enabled KV.

1) Install:

```shell
npm install @launchdarkly/cloudflare-server-sdk-ai --save
```

2) Configure `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"
```

3) Use in a Worker:

```typescript
import { init } from '@launchdarkly/cloudflare-server-sdk';
import { initAi } from '@launchdarkly/cloudflare-server-sdk-ai';

export default {
  async fetch(_request, env, ctx) {
    const ldClient = init(env.LD_CLIENT_ID, env.LD_KV, { sendEvents: true });
    await ldClient.waitForInitialization();

    const ai = initAi(ldClient, { clientSideID: env.LD_CLIENT_ID, kvNamespace: env.LD_KV });
    const context = { kind: 'user', key: 'example-user' };

    const config = await ai.config(
      'my-ai-config',
      context,
      { enabled: false, model: { name: '@cf/meta/llama-3-8b-instruct' } },
      { username: 'Sandy' },
    );

    if (!config.enabled) return new Response('AI disabled', { status: 503 });

    const wc = config.toWorkersAI(env.AI);
    const result = await config.tracker.trackWorkersAIMetrics(() => env.AI.run(wc.model, wc));

    ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()));
    return Response.json(result);
  }
};
```

See `example/` for a full working sample.

## API (brief)

• `initAi(ldClient, options?)` → `LDAIClient`
• `aiClient.config(key, context, defaultValue, variables?)` → `Promise<LDAIConfig>`
• `aiClient.agent(key, context, defaultValue, variables?)` → `Promise<LDAIAgent>`
• `aiClient.agents(configs, context)` → `Promise<Record<key, LDAIAgent>>`
• `config.toWorkersAI(env.AI, options?)` → `WorkersAIConfig`

Metrics:

```typescript
await config.tracker.trackWorkersAIMetrics(() => env.AI.run(wc.model, wc));
const stream = config.tracker.trackWorkersAIStreamMetrics(() => env.AI.run(wc.model, { ...wc, stream: true }));
```

Notes:
- Templates use Mustache. Variables you pass plus the LD context via `{{ldctx.*}}` are available.
- Parameter names are normalized when mapping to Workers AI (e.g., `maxTokens`/`maxtokens` → `max_tokens`, `topP`/`topp` → `top_p`, `topK`/`topk` → `top_k`).


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

