import { init, LDClient } from '@launchdarkly/node-server-sdk';

// eslint-disable-next-line import/no-mutable-exports
export let serverSideLDClient: LDClient;

/**
 * https://github.com/vercel/next.js/issues/49565#issuecomment-1902082982
 */
export function registerLD(sdkKey: string) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    serverSideLDClient = init(sdkKey);
  }
}
