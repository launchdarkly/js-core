import { init } from '@launchdarkly/vercel-server-sdk';
import { createClient } from '@vercel/edge-config';

const edgeClient = createClient(process.env.EDGE_CONFIG);
if (!edgeClient) {
  throw new Error('Edge Client could not be initialized');
}
export const ldEdgeClient = init(process.env.LD_CLIENT_SIDE_ID || '', edgeClient);
