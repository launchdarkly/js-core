# Cloudflare Workers AI + LaunchDarkly: Random Joke Example

This example shows how to use LaunchDarkly AI Configs with Cloudflare Workers AI to generate a random joke when you curl the endpoint with a user ID.

## Prerequisites

1. Node.js 16 or higher
2. Yarn package manager
3. Cloudflare account with Workers AI enabled
4. Wrangler CLI (`yarn add -D wrangler@latest`)
5. LaunchDarkly account
6. **LaunchDarkly Cloudflare KV integration enabled** (see setup below)

**This SDK requires the [LaunchDarkly Cloudflare KV integration](https://docs.launchdarkly.com/integrations/cloudflare)** to automatically sync your feature flags to Cloudflare KV.

### Enable the Integration:

1. Go to [LaunchDarkly → Settings → Integrations](https://app.launchdarkly.com/settings/integrations)
2. Find **Cloudflare KV** and click **Add Integration**
3. Connect your Cloudflare account
4. Select your KV namespace (create one if needed)
5. Choose the LaunchDarkly environment to sync
6. Save the integration

Once enabled, LaunchDarkly will automatically push your flags to Cloudflare KV whenever they change. The SDK reads from this KV storage for ultra-fast edge evaluation.


## Setup

### 1. Build the SDKs

From the root of js-core:

```bash
yarn && yarn build
```

### 2. Create KV Namespace

Create a KV namespace for LaunchDarkly data:

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace (production)
wrangler kv:namespace create "LD_KV"
# Note the ID returned

# Create KV namespace (preview)
wrangler kv:namespace create "LD_KV" --preview
# Note the preview ID returned
```

### 3. Configure wrangler.toml

Edit `wrangler.toml` and replace:

- `YOUR_KV_ID` with your production KV namespace ID
- `YOUR_PREVIEW_KV_ID` with your preview KV namespace ID
- `your-client-side-id` with your LaunchDarkly client-side ID

```toml
compatibility_flags = ["nodejs_compat"]

kv_namespaces = [{ binding = "LD_KV", id = "YOUR_KV_ID", preview_id = "YOUR_PREVIEW_KV_ID" }]

[vars]
LD_CLIENT_ID = "LD_CLIENT_ID"

[ai]
binding = "AI"
```

### 4. Create LaunchDarkly AI Config (Random Joke)

Create an AI Config that the worker will use to generate a random joke.

1) In LaunchDarkly, go to **AI Configs → Create AI Config**
- **Key**: `random-joke` (required — the worker uses this key)
- Click **Create AI Config**

2) Choose a Cloudflare model
- You can use any model from Cloudflare's list. If it's not pre-listed in LaunchDarkly, add a custom model:
  - Go to **Project settings → AI model configs → Add custom model**
  - **Model ID**: paste a Workers AI model ID (e.g. `@cf/meta/llama-3.1-8b-instruct-fast`)
  - **Provider**: `Cloudflare Workers AI` (or Custom)
  - Save

3) Set parameters (optional but recommended)
- `temperature`: `0.7` to `0.9`
- `max_tokens`: `120` to `200`

4) Add message (your prompt)
- User: `Tell a random joke.`

5) Targeting
- Enable targeting for your environment and serve the variation to all users.

Refer to: [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/) for the full model list, and [LD AI Config docs](https://launchdarkly.com/docs/home/ai-configs/create) for configuration details.



### 5. Run the Example

```bash
cd packages/sdk/cloudflare-ai/example
yarn start
```

## Testing

Call the worker with a `userId`:

```bash
curl "http://localhost:8787?userId=user-123"
```

Expected response:

```json
{
  "success": true,
  "userId": "user-123",
  "model": "@cf/meta/llama-3.1-8b-instruct-fast",
  "provider": "cloudflare-workers-ai",
  "joke": "Why do programmers prefer dark mode? Because light attracts bugs!",
  "enabled": true
}
```

## How It Works

1. Initialize clients: LaunchDarkly + AI client
2. Get AI Config: retrieves `random-joke` from LaunchDarkly
3. Call model: `wc = config.toWorkersAI(env.AI)` then `await config.tracker.trackWorkersAIMetrics(() => env.AI.run(wc.model, wc))`
4. Flush events: `ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()))`

## LaunchDarkly Features

### Variations and Rollouts

- Create multiple variations to compare models, temperatures, and styles
- Target specific users or segments; do percentage rollouts
- All changes sync automatically to Cloudflare KV

### Metrics and AI Config Analytics

- The SDK records `$ld:ai:generation`, `$ld:ai:tokens`, `$ld:ai:duration`, and `$ld:ai:ttft` events
- Events include `aiConfigKey`, `variationKey`, `version`, `model`, and `provider`
- This links Live events to your AI Config analytics in LaunchDarkly

## Deployment

```bash
yarn deploy
```


## Model Options

Pick any Workers AI model ID:

- `@cf/meta/llama-3.1-8b-instruct-fast` — fast, good quality
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — higher quality
- `@cf/mistralai/mistral-7b-instruct-v0.1` — alternative
- `@cf/qwen/qwq-32b` — advanced reasoning

See: [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/)

