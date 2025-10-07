# Setup Checklist

Quick reference for setting up the Cloudflare Workers AI + LaunchDarkly example.

## Required Values

Fill in these values as you complete the setup:

```
LaunchDarkly Client-Side ID: _______________________
KV Namespace ID (prod):      _______________________
KV Namespace ID (preview):   _______________________
AI Config Flag Name:         joke-ai-config
```

## Quick Setup Steps

### 1. Create KV Namespaces

```bash
wrangler kv:namespace create "LD_KV"
# Copy the ID: _______________

wrangler kv:namespace create "LD_KV" --preview
# Copy the preview_id: _______________
```

### 2. Update wrangler.toml

Replace these values in `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "LD_KV", id = "YOUR_KV_ID", preview_id = "YOUR_PREVIEW_KV_ID" }
]

[vars]
LD_CLIENT_ID = "your-client-side-id"
```

### 3. Enable LaunchDarkly Cloudflare KV Integration

1. Go to [LaunchDarkly → Settings → Integrations](https://app.launchdarkly.com/settings/integrations)
2. Find **Cloudflare KV** and add the integration
3. Connect your Cloudflare account
4. Select your KV namespace created in step 1
5. Choose your LaunchDarkly environment
6. Save - LaunchDarkly will automatically sync flags to KV

### 4. Create AI Config Flag in LaunchDarkly

In your LaunchDarkly dashboard:
1. Create a flag named `joke-ai-config`
2. Set the variation to include `_ldMeta.enabled: true` and your AI config
3. Turn the flag ON
4. Save and publish (syncs to KV automatically)

### 5. Verify Setup

```bash
# Check KV data exists
wrangler kv:key get --binding=LD_KV "LD-Env-your-client-side-id" --preview

# Start the worker
yarn start

# Test it
curl "http://localhost:8787?topic=cats"
```

## Expected Response

```json
{
  "success": true,
  "userId": "anonymous-user",
  "topic": "cats",
  "model": "@cf/meta/llama-3.1-8b-instruct-fast",
  "joke": "Why don't cats play poker? Too many cheetahs!",
  "metrics": {
    "durationMs": 450,
    "enabled": true
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find LD data" | Verify LaunchDarkly KV integration is connected and synced |
| "AI not enabled" | Check flag has `_ldMeta.enabled: true` in LaunchDarkly |
| "Invalid model" | Ensure Workers AI is enabled in Cloudflare |
| "401 Unauthorized" | Run `wrangler login` |
| "Unknown feature flag" | Verify flag name is `joke-ai-config` and flag is ON |

## What Each File Does

- `wrangler.toml` - Worker configuration
- `src/index.ts` - Main worker code
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config

## Next Steps After Setup

1. Test with different topics: `?topic=dogs`, `?topic=space`
2. Try different user IDs: `?userId=user-123`
3. Modify your AI config in LaunchDarkly dashboard (syncs automatically)
4. Test different models and prompts via LaunchDarkly
5. Deploy: `yarn deploy`

