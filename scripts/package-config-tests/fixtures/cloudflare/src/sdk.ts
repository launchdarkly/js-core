import { init } from '@launchdarkly/cloudflare-server-sdk';
import type { LDClient } from '@launchdarkly/cloudflare-server-sdk';

interface Env {
  LD_KV: KVNamespace;
}

let client: LDClient | undefined;

export default {
  async fetch(_req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    client ??= init('test-client-side-id', env.LD_KV, { sendEvents: false });
    await client.waitForInitialization({ timeout: 5 });
    const context = { kind: 'user', key: 'u1' };
    const value = await client.boolVariation('sample-feature', context, false);
    const detail = await client.variationDetail('sample-feature', context, false);
    const all = (await client.allFlagsState(context)).toJSON();
    ctx.waitUntil(client.flush());
    return Response.json({
      entry: 'sdk',
      initialized: client.initialized(),
      value,
      reason: detail.reason,
      flags: Object.keys(all).filter((k) => !k.startsWith('$')),
    });
  },
};
