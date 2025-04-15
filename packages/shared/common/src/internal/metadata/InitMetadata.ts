/**
 * Metadata used to initialize an LDFeatureStore.
 *
 * @internal
 */
export interface InitMetadata {
  environmentId: string;
}

/**
 * Creates an InitMetadata object from initialization headers.
 *
 * @param initHeaders Initialization headers received when establishing
 * a streaming or polling connection to LD.
 * @returns InitMetadata object, or undefined if initHeaders is undefined
 * or missing the required header values.
 *
 * @internal
 */
export function initMetadataFromHeaders(initHeaders?: {
  [key: string]: string;
}): InitMetadata | undefined {
  if (initHeaders) {
    const envIdKey = Object.keys(initHeaders).find((key) => key.toLowerCase() === 'x-ld-envid');
    if (envIdKey) {
      return { environmentId: initHeaders[envIdKey] };
    }
  }
  return undefined;
}
