import { Context, Crypto } from '@launchdarkly/js-sdk-common';

import digest from '../crypto/digest';

export type Namespace = 'LaunchDarkly' | 'AnonymousKeys' | 'ContextKeys' | 'ContextIndex';

/**
 * Hashes the input and encodes it as base64
 */
function hashAndBase64Encode(crypto: Crypto): (input: string) => Promise<string> {
  return async (input) => digest(crypto.createHash('sha256').update(input), 'base64');
}

const noop = async (input: string) => input; // no-op transform

export async function concatNamespacesAndValues(
  parts: { value: Namespace | string; transform: (value: string) => Promise<string> }[],
): Promise<string> {
  const processedParts = await Promise.all(parts.map((part) => part.transform(part.value))); // use the transform from each part to transform the value
  return processedParts.join('_');
}

export async function namespaceForEnvironment(crypto: Crypto, sdkKey: string): Promise<string> {
  return concatNamespacesAndValues([
    { value: 'LaunchDarkly', transform: noop },
    { value: sdkKey, transform: hashAndBase64Encode(crypto) }, // hash sdk key and encode it
  ]);
}

/**
 * @deprecated Used only for migration in ensureKey. Data stored under LaunchDarkly_AnonymousKeys
 * is now migrated to LaunchDarkly_ContextKeys on first access. This function can be removed once
 * all clients have had the chance to run the migration.
 */
export async function namespaceForAnonymousGeneratedContextKey(kind: string): Promise<string> {
  return concatNamespacesAndValues([
    { value: 'LaunchDarkly', transform: noop },
    { value: 'AnonymousKeys', transform: noop },
    { value: kind, transform: noop }, // existing SDKs are not hashing or encoding this kind, though they should have
  ]);
}

export async function namespaceForGeneratedContextKey(kind: string): Promise<string> {
  return concatNamespacesAndValues([
    { value: 'LaunchDarkly', transform: noop },
    { value: 'ContextKeys', transform: noop },
    { value: kind, transform: noop }, // existing SDKs are not hashing or encoding this kind, though they should have
  ]);
}

export async function namespaceForContextIndex(environmentNamespace: string): Promise<string> {
  return concatNamespacesAndValues([
    { value: environmentNamespace, transform: noop },
    { value: 'ContextIndex', transform: noop },
  ]);
}

export async function namespaceForContextData(
  crypto: Crypto,
  environmentNamespace: string,
  context: Context,
): Promise<string> {
  return concatNamespacesAndValues([
    { value: environmentNamespace, transform: noop }, // use existing namespace as is, don't transform
    { value: context.canonicalKey, transform: hashAndBase64Encode(crypto) }, // hash and encode canonical key
  ]);
}
