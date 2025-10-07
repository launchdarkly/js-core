/**
 * This is the API reference for the LaunchDarkly AI SDK for Cloudflare Workers.
 *
 * In typical usage, you will call {@link initAi} once at startup time to obtain an instance of
 * {@link LDAIClient}, which provides access to all of the SDK's AI configuration functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import type { KVNamespace } from '@cloudflare/workers-types';

import type { LDAIClient } from './api/LDAIClient';
import { setClientKVMeta } from './ClientKVMeta';
import { LDAIClientImpl } from './LDAIClientImpl';
import type { LDClientMin } from './LDClientMin';

// KV metadata helpers moved to ClientKVMeta to avoid cycles

/**
 * Initialize a new AI client. This client will be used to perform AI configuration operations.
 * @param ldClient The base LaunchDarkly Cloudflare client.
 * @param clientSideID Optional client-side ID for direct AI Config reading from KV.
 * @param kvNamespace Optional KV namespace for direct AI Config access.
 * @returns A new AI client.
 */
export function initAi(
  ldClient: LDClientMin,
  options?: { clientSideID?: string; kvNamespace?: KVNamespace },
): LDAIClient {
  if (options?.clientSideID && options?.kvNamespace) {
    setClientKVMeta(ldClient, options.clientSideID, options.kvNamespace);
  }
  return new LDAIClientImpl(ldClient);
}

export * from './api';
// No public mapper export; mapping is handled inline.
