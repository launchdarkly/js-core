import LDMongoDBOptions from './LDMongoDBOptions';

/**
 * The default TTL cache time in seconds.
 */
const DEFAULT_CACHE_TTL_S = 30;

/**
 * Get a cache TTL based on LDMongoDBOptions. If the TTL is not specified, then
 * the default of 30 seconds will be used.
 * @param options The options to get a TTL for.
 * @returns The TTL, in seconds.
 * @internal
 */
export default function TtlFromOptions(options?: LDMongoDBOptions): number {
  // 0 is a valid option. So we need a null/undefined check.
  if (options?.cacheTTL === undefined || options.cacheTTL === null) {
    return DEFAULT_CACHE_TTL_S;
  }
  return options!.cacheTTL;
}
