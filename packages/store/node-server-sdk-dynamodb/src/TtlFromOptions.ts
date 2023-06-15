import LDDynamoDBOptions from './LDDynamoDBOptions';

/**
 * The default TTL cache time in seconds.
 */
const DEFAULT_CACHE_TTL_S = 15;

/**
 * Get a cache TTL based on LDDynamoDBOptions. If the TTL is not specified, then
 * the default of 15 seconds will be used.
 * @param options The options to get a TTL for.
 * @returns The TTL, in seconds.
 * @internal
 */
export default function TtlFromOptions(options?: LDDynamoDBOptions): number {
  // 0 is a valid option. So we need a null/undefined check.
  if (options?.cacheTTL === undefined || options.cacheTTL === null) {
    return DEFAULT_CACHE_TTL_S;
  }
  return options!.cacheTTL;
}
