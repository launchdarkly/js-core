import { OpenFeature } from '@openfeature/server-sdk';

import { LaunchDarklyProvider } from '@launchdarkly/openfeature-cloudflare-server';

interface Env {
  LD_KV: KVNamespace;
}

let ready: Promise<unknown> | undefined;

export default {
  async fetch(_req: Request, env: Env): Promise<Response> {
    ready ??= OpenFeature.setProviderAndWait(
      new LaunchDarklyProvider('test-client-side-id', env.LD_KV, { sendEvents: false }),
    );
    await ready;
    const details = await OpenFeature.getClient().getBooleanDetails('sample-feature', false, {
      targetingKey: 'u1',
    });
    return Response.json({
      entry: 'openfeature',
      value: details.value,
      reason: details.reason,
      errorCode: details.errorCode ?? null,
    });
  },
};
