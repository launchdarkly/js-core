import { init } from '@launchdarkly/vercel-server-sdk';
import { createClient } from '@vercel/edge-config';

const edgeConfigClient = createClient(process.env.EDGE_CONFIG);
if (!edgeConfigClient) {
  throw new Error('Edge Config client could not be initialized');
}
export const ldEdgeClient = init(process.env.LD_CLIENT_SIDE_ID || '', edgeConfigClient);
