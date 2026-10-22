import { createClient } from '@vercel/edge-config';

import { init } from '@launchdarkly/vercel-server-sdk';
import type { LDClient } from '@launchdarkly/vercel-server-sdk';

let client: LDClient | undefined;
export function getClient(): LDClient {
  client ??= init('test-client-side-id', createClient(process.env.EDGE_CONFIG!));
  return client;
}
export async function evaluate(entry: string) {
  const c = getClient();
  await c.waitForInitialization({ timeout: 5 });
  const context = { kind: 'user', key: 'u1' };
  const value = await c.boolVariation('sample-feature', context, false);
  const detail = await c.variationDetail('sample-feature', context, false);
  const all = (await c.allFlagsState(context)).toJSON();
  return {
    entry,
    initialized: c.initialized(),
    value,
    reason: detail.reason,
    flags: Object.keys(all).filter((k) => !k.startsWith('$')),
  };
}
