/**
 * SHARED: Safe to import from both Server Components and Client Components.
 * Do not import server-only modules (e.g. ld-server, node-server-sdk, react-sdk/server) here.
 *
 * Single isomorphic client instance. Server-only code (ld-server.ts) federates this
 * client with useServerClient() so the same API works in RSC and the browser.
 */
import { defaultContext } from './ld-context';
import {createClient} from '@launchdarkly/react-sdk';

const ldClient = createClient(
  process.env.LD_CLIENT_SIDE_ID || 'test-client-side-id',
  defaultContext,
  {
    streaming: true,
  },
);

ldClient.start();

export default ldClient;