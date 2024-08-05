import { Context, Crypto } from '@launchdarkly/js-sdk-common';

export type Namespace = 'LaunchDarkly' | 'AnonymousKeys' | 'ContextKeys' | 'ContextIndex';

/**
 * Hashes the input and encodes it as hex
 */
function hashValue(crypto: Crypto, input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64');
}

export function concatNamespacesAndValues(
  crypto: Crypto,
  parts: { value: Namespace | string; hashIt: boolean }[],
): string {
  const processedParts: string[] = [];
  parts.forEach((part) => {
    if (part.hashIt) {
      processedParts.push(hashValue(crypto, part.value));
    } else {
      processedParts.push(part.value);
    }
  });

  return processedParts.join('_');
}

export function namespaceForEnvironment(crypto: Crypto, sdkKey: string): string {
  return concatNamespacesAndValues(crypto, [
    { value: 'LaunchDarkly', hashIt: false },
    { value: sdkKey, hashIt: true }, // hash sdk key
  ]);
}

/**
 * @deprecated prefer {@link namespaceForGeneratedContextKey}. At one time we only generated keys for
 * anonymous contexts and they were namespaced in LaunchDarkly_AnonymousKeys.  Eventually we started
 * generating context keys for non-anonymous contexts such as for the Auto Environment Attributes
 * feature and those were namespaced in LaunchDarkly_ContextKeys.  This function can be removed
 * when the data under the LaunchDarkly_AnonymousKeys namespace is merged with data under the
 * LaunchDarkly_ContextKeys namespace.
 */
export function namespaceForAnonymousGeneratedContextKey(crypto: Crypto, kind: string): string {
  return concatNamespacesAndValues(crypto, [
    { value: 'LaunchDarkly', hashIt: false },
    { value: 'AnonymousKeys', hashIt: false },
    { value: kind, hashIt: false },
  ]);
}

export function namespaceForGeneratedContextKey(crypto: Crypto, kind: string): string {
  return concatNamespacesAndValues(crypto, [
    { value: 'LaunchDarkly', hashIt: false },
    { value: 'ContextKeys', hashIt: false },
    { value: kind, hashIt: false },
  ]);
}

export function namespaceForContextIndex(crypto: Crypto, environmentNamespace: string): string {
  return concatNamespacesAndValues(crypto, [
    { value: environmentNamespace, hashIt: false },
    { value: 'ContextIndex', hashIt: false },
  ]);
}

export function namespaceForContextData(
  crypto: Crypto,
  environmentNamespace: string,
  context: Context,
): string {
  return concatNamespacesAndValues(crypto, [
    { value: environmentNamespace, hashIt: false },
    { value: context.canonicalKey, hashIt: true }, // hash canonical key
  ]);
}
