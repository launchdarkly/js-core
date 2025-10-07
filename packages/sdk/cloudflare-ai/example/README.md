# Cloudflare Workers AI + LaunchDarkly Example

This example demonstrates using LaunchDarkly AI Configs with Cloudflare Workers AI to generate jokes dynamically.

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

### 4. Create LaunchDarkly AI Config

In your LaunchDarkly dashboard, create an AI Config that will control your Cloudflare Workers AI model. Follow the [official LaunchDarkly documentation](https://launchdarkly.com/docs/home/ai-configs/create) for creating AI Configs.

#### Step 1: Add a Custom Model for Cloudflare Workers AI

Since Cloudflare Workers AI models are not yet built into LaunchDarkly's model list, you'll need to add a custom model first.

1. **Navigate to Project Settings**
   - Go to https://app.launchdarkly.com
   - Click your project dropdown
   - Select **Project settings**
   - Select **AI model configs**

2. **Create a Custom Model**
   - Click **Add custom model**
   - Complete the "Add custom model" dialog:
     - **Model name**: Enter a descriptive name like `Llama 3.1 8B Instruct Fast`
     - **Model ID**: Enter the Cloudflare model ID, e.g., `@cf/meta/llama-3.1-8b-instruct-fast`
     - **Model type**: Select **Chat**
     - **Provider**: Select **Custom** or enter `Cloudflare Workers AI`
   - Click **Save**

Refer to the [LaunchDarkly documentation for creating custom models](https://launchdarkly.com/docs/home/ai-configs/create-model-config#complete-the-add-custom-model-dialog) for more details.

**Popular Cloudflare Workers AI Models to Add:**

| Model Name | Model ID | Use Case |
|------------|----------|----------|
| Llama 3.1 8B Instruct Fast | `@cf/meta/llama-3.1-8b-instruct-fast` | Quick responses, simple tasks |
| Llama 3.3 70B Instruct | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Complex reasoning, better quality |
| Llama 3.1 70B Instruct | `@cf/meta/llama-3.1-70b-instruct` | High quality production |
| Qwen 2.5 14B Instruct | `@cf/qwen/qwen-2.5-14b-instruct` | Balanced performance |

See [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/) for the complete list.

#### Step 2: Create the AI Config

1. **Create a new AI Config**
   - In LaunchDarkly, click **AI Configs**
   - Click **Create AI Config**
   - **Name**: `joke-ai-config`
   - Click **Create AI Config**

2. **Create a Variation**
   - Select the **Variations** tab
   - Enter a variation **Name**, e.g., `Joke Generator`
   - Click **Select a model** and choose the custom Cloudflare model you created
   - Click **Add parameters** to configure model parameters:
     - **Model parameters**:
       - `temperature`: `0.8` (controls creativity, 0.0-1.0)
       - `max_tokens`: `200` (maximum response length)

3. **Add Messages**
   - Select message role: **system**
   - Enter message content: `You are a funny comedian who tells short jokes.`
   - Click **+ Add another message**
   - Select message role: **user**
   - Enter message content: `Tell me a {{joke_type}} joke{{topic_section}}.`
     - The `{{joke_type}}` and `{{topic_section}}` variables are provided at runtime by the example
   - Click **Review and save**

Refer to the [LaunchDarkly documentation for creating variations](https://launchdarkly.com/docs/home/ai-configs/create-variation) for more details.

#### Step 3: Configure Targeting

   **Set up targeting rules**
   - In your AI Config, go to the **Targeting** tab
   - Enable targeting for your environment
   - Set the default rule to serve your variation to all users
   - Click **Review and save**



### 5. Run the Example

```bash
cd packages/sdk/cloudflare-ai/example
yarn start
```

## Testing

Test the worker:

```bash
# Default joke about programming
curl "http://localhost:8787"

# Custom topic
curl "http://localhost:8787?topic=cats"

# With specific user ID
curl "http://localhost:8787?userId=user-123&topic=dogs"

# Specify joke type
curl "http://localhost:8787?joke_type=knock-knock&topic=penguins"
```

Expected response:

```json
{
  "success": true,
  "userId": "anonymous-user",
  "topic": "programming",
  "model": "@cf/meta/llama-3.1-8b-instruct-fast",
  "provider": "cloudflare-workers-ai",
  "joke": "Why do programmers prefer dark mode? Because light attracts bugs!",
  "enabled": true
}
```

## How It Works

1. **Initialize Clients**: Creates LaunchDarkly and AI clients
2. **Get AI Config**: Retrieves `joke-ai-config` from LaunchDarkly with variables `{ joke_type, topic_section }`
3. **Variable Interpolation**: Fills `{{joke_type}}` and `{{topic_section}}` in messages
4. **Call AI Model**: Map to Workers AI via `config.toWorkersAI(env.AI)` and run with metrics using `await config.tracker.trackWorkersAIMetrics(() => env.AI.run(wc.model, wc))`
5. **Flush Events**: Uses `ctx.waitUntil(ldClient.flush().finally(() => ldClient.close()))`

## LaunchDarkly Features

### Multiple Variations

Create multiple variations in your AI Config to test different:
- Models (fast vs. high-quality)
- Prompt styles
- Temperature and parameter settings
- System instructions

### Dynamic Prompts

Update prompts through the LaunchDarkly UI without redeploying:
- Modify system messages
- Change user prompts
- Add or remove conversation context
- Use variable interpolation with `{{variableName}}` syntax

### Targeted Rollouts

Use LaunchDarkly's targeting features to control who sees which variation:
- Target specific users or segments
- Percentage rollouts (e.g., 10% of users get new model)
- Geographic targeting
- Custom attribute targeting

All changes are made through the LaunchDarkly dashboard and sync automatically to your Cloudflare Workers.

## Deployment

```bash
yarn deploy
```


## Model Options

You can use any Cloudflare Workers AI model with their full model ID:

- `@cf/meta/llama-3.1-8b-instruct-fast` - Fast, good quality
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - High quality, slower
- `@cf/mistralai/mistral-7b-instruct-v0.1` - Alternative option
- `@cf/qwen/qwq-32b` - Advanced reasoning

See [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/) for full list.

