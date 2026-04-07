/**
 * Derives a storage/IPC namespace from a credential and an optional user-provided namespace.
 *
 * When `customNamespace` is undefined the output is just the credential,
 * preserving backward compatibility for single-client apps.
 */
export function deriveNamespace(credential: string, customNamespace?: string): string {
  return customNamespace ? `${customNamespace}:${credential}` : credential;
}
