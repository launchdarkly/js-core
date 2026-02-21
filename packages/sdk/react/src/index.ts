import { LDContext } from '@launchdarkly/js-client-sdk';
import { createIsomorphicClient } from './createIsomorphicClient';
import { LDIsomorphicClient } from './LDIsomorphicClient';
import { LDIsomorphicOptions } from './LDIsomorphicOptions';

export type * from '@launchdarkly/js-client-sdk';
export type { LDIsomorphicClient } from './LDIsomorphicClient';
export type { LDIsomorphicOptions } from './LDIsomorphicOptions';

/**
 * Creates an isomorphic LaunchDarkly client that works in both Client Components
 * and, when federated with a server client via useServerClient(), in Server Components.
 * On the server without a federated server client, evaluation methods no-op and return defaults.
 */
export function createClient(
  clientSideID: string,
  context: LDContext,
  options?: LDIsomorphicOptions,
): LDIsomorphicClient {
  return createIsomorphicClient(clientSideID, context, options);
}
