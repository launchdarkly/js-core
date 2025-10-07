import type { KVNamespace } from '@cloudflare/workers-types';

import type { LDClientMin } from './LDClientMin';

type KvMeta = { clientSideID: string; kvNamespace: KVNamespace };

const clientToKvMeta = new WeakMap<LDClientMin, KvMeta>();

export function setClientKVMeta(
  ldClient: LDClientMin,
  clientSideID: string,
  kvNamespace: KVNamespace,
): void {
  clientToKvMeta.set(ldClient, { clientSideID, kvNamespace });
}

export function getClientKVMeta(ldClient: LDClientMin): KvMeta | null {
  return clientToKvMeta.get(ldClient) ?? null;
}
