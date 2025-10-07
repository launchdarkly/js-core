# Working Commands - Step by Step

These commands are tested and work. Follow them in order.

## Prerequisites

You've already done:
- ✅ Created KV namespaces
- ✅ Updated `wrangler.toml` with your IDs

## Step 1: Build the SDK (from repo root)

```bash
cd /Users/menelikzafir/Documents/SDKs/js-core
yarn workspace @launchdarkly/cloudflare-server-sdk-ai build
```

## Step 2: Verify LaunchDarkly KV Integration

Make sure the LaunchDarkly Cloudflare KV integration is enabled and syncing:

1. Go to [LaunchDarkly Integrations](https://app.launchdarkly.com/settings/integrations)
2. Verify Cloudflare KV integration is connected
3. Check that your AI config flag is created and ON
4. LaunchDarkly automatically syncs flags to your KV namespace

To verify data is in KV:

```bash
cd /Users/menelikzafir/Documents/SDKs/js-core/packages/sdk/cloudflare-ai/example

# Check if LaunchDarkly synced data to KV
npx wrangler kv:key get --binding=LD_KV "LD-Env-YOUR-CLIENT-SIDE-ID"
```

## Step 3: Build the Example Worker

```bash
cd /Users/menelikzafir/Documents/SDKs/js-core/packages/sdk/cloudflare-ai/example
npx tsc
```

## Step 4: Run Locally

```bash
# For local testing with mock KV/AI
npx wrangler dev --local

# Or connect to your Cloudflare account
npx wrangler dev
```

## Step 5: Test

In another terminal:

```bash
# Basic test
curl "http://localhost:8787"

# With custom topic
curl "http://localhost:8787?topic=dogs"

# With user ID
curl "http://localhost:8787?userId=user-123&topic=space"
```

## Alternative: Simplified Local Testing

If KV setup is problematic, modify `src/index.ts` to use a hardcoded config for local testing:

```typescript
// Add this at the top of the fetch handler for testing
const config = await aiClient.config(
  'joke-ai-config',
  context,
  {
    enabled: true,  // Force enabled for local testing
    model: { name: 'llama-3.1-8b' },
    messages: [
      { role: 'system', content: 'You are a comedian.' },
      { role: 'user', content: 'Tell a joke about {{topic}}' }
    ]
  },
  { topic }
);
```

## Common Issues

**"Cannot find module '@launchdarkly/cloudflare-server-sdk'"**
- Solution: Run `yarn workspace @launchdarkly/cloudflare-server-sdk-ai build` from repo root

**"namespace not found"**
- Solution: Use `--local` flag with wrangler dev for testing, or verify KV namespaces with `npx wrangler kv:namespace list`

**"AI binding not available"**
- Solution: Workers AI might not be available in local mode. Deploy to test AI features: `npx wrangler deploy`

**TypeScript errors about AI types**
- Solution: This is expected. The types are strict. The code will work at runtime.

