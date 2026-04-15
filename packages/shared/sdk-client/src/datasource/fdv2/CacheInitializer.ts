import { Context, Crypto, internal, LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import { readFreshness } from '../../storage/freshness';
import { loadCachedFlags } from '../../storage/loadCachedFlags';
import { Flag } from '../../types';
import { changeSet, FDv2SourceResult, shutdown } from './FDv2SourceResult';
import { Initializer } from './Initializer';
import { InitializerFactory } from './SourceManager';

/**
 * Configuration for creating a cache initializer.
 */
export interface CacheInitializerConfig {
  /** Platform storage for reading cached data. */
  storage: Storage | undefined;
  /** Platform crypto for computing storage keys. */
  crypto: Crypto;
  /** Environment namespace (hashed SDK key). */
  environmentNamespace: string;
  /** The context to load cached data for. */
  context: Context;
  /** Optional logger. */
  logger?: LDLogger;
}

/**
 * Strips the `version` field from a stored {@link Flag} to produce the
 * `FlagEvaluationResult` shape expected in an FDv2 `Update.object`.
 *
 * The version is carried on the `Update` envelope, not on the object itself.
 */
function flagToEvaluationResult(flag: Flag): Omit<Flag, 'version'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, ...evalResult } = flag;
  return evalResult;
}

/**
 * Reads cached flag data and freshness from platform storage and returns
 * them as an {@link FDv2SourceResult}.
 */
async function loadFromCache(config: CacheInitializerConfig): Promise<FDv2SourceResult> {
  const { storage, crypto, environmentNamespace, context, logger } = config;

  if (!storage) {
    logger?.debug('No storage available for cache initializer');
    return changeSet({ version: 0, type: 'none', updates: [] }, false);
  }

  const cached = await loadCachedFlags(storage, crypto, environmentNamespace, context, logger);
  if (!cached) {
    logger?.debug('Cache miss for context');
    return changeSet({ version: 0, type: 'none', updates: [] }, false);
  }

  const updates: internal.Update[] = Object.entries(cached.flags).map(
    ([key, flag]): internal.Update => ({
      kind: 'flag-eval',
      key,
      version: flag.version,
      object: flagToEvaluationResult(flag),
    }),
  );

  const payload: internal.Payload = {
    version: 0,
    // No `state` field. The orchestrator sees a changeSet without a selector,
    // records dataReceived=true, and continues to the next initializer.
    type: 'full',
    updates,
  };

  const freshness = await readFreshness(storage, crypto, environmentNamespace, context, logger);

  logger?.debug('Loaded cached flag evaluations via cache initializer');
  return changeSet(payload, false, undefined, freshness);
}

/**
 * Creates an {@link InitializerFactory} that produces cache initializers.
 *
 * The cache initializer reads flag data and freshness from persistent storage
 * for the given context and returns them as a changeSet without a selector.
 * This allows the orchestrator to provide cached data immediately while
 * continuing to the next initializer for network-verified data.
 *
 * Per spec Requirement 4.1.2, the payload has `persist=false` semantics
 * (no selector) so the consuming layer should not re-persist it.
 *
 * @internal
 */
export function createCacheInitializerFactory(config: CacheInitializerConfig): InitializerFactory {
  // The selectorGetter is ignored — cache data has no selector.
  return (_selectorGetter: () => string | undefined): Initializer => {
    let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
    const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
      shutdownResolve = resolve;
    });

    return {
      async run(): Promise<FDv2SourceResult> {
        return Promise.race([shutdownPromise, loadFromCache(config)]);
      },

      close(): void {
        shutdownResolve?.(shutdown());
        shutdownResolve = undefined;
      },
    };
  };
}
