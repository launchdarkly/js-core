import { initNodeSdk } from '@launchdarkly/react-universal-sdk/server';

export async function register() {
  await initNodeSdk();
}
