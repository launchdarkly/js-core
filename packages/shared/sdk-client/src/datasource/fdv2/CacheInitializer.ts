import { Context, Crypto, internal, LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import { namespaceForContextData } from '../../storage/namespaceUtils';
import { Flag, Flags } from '../../types';
import {
  changeSet,
  errorInfoFromUnknown,
  FDv2SourceResult,
  interrupted,
  shutdown,
} from './FDv2SourceResult';
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
 * Reads cached flag data from platform storage and returns it as an
 * {@link FDv2SourceResult}.
 */
async function loadFromCache(config: CacheInitializerConfig): Promise<FDv2SourceResult> {
  const { storage, crypto, environmentNamespace, context, logger } = config;

  if (!storage) {
    logger?.debug('No storage available for cache initializer');
    return interrupted(errorInfoFromUnknown('No storage available'), false);
  }

  const storageKey = await namespaceForContextData(crypto, environmentNamespace, context);
  let flagsJson = await storage.get(storageKey);

  // Fallback: in version <10.3.1 flag data was stored under the canonical key.
  // Read-only check — migration happens when network data is persisted via the
  // normal FlagPersistence path.
  if (flagsJson === null || flagsJson === undefined) {
    flagsJson = await storage.get(context.canonicalKey);
  }

  if (flagsJson === null || flagsJson === undefined) {
    logger?.debug('Cache miss for context');
    return interrupted(errorInfoFromUnknown('Cache miss'), false);
  }

  try {
    const flags: Flags = JSON.parse(flagsJson);
    const updates: internal.Update[] = Object.entries(flags).map(
      ([key, flag]): internal.Update => ({
        kind: 'flagEval',
        key,
        version: flag.version,
        object: flagToEvaluationResult(flag),
      }),
    );

    const payload: internal.Payload = {
      id: 'cache',
      version: 0,
      // No `state` field. The orchestrator sees a changeSet without a selector,
      // records dataReceived=true, and continues to the next initializer.
      type: 'full',
      updates,
    };

    logger?.debug('Loaded cached flag evaluations via cache initializer');
    return changeSet(payload, false);
  } catch (e: any) {
    logger?.warn(`Could not parse cached flag evaluations: ${e.message}`);
    return interrupted(errorInfoFromUnknown(`Cache parse error: ${e.message}`), false);
  }
}

/**
 * Creates an {@link InitializerFactory} that produces cache initializers.
 *
 * The cache initializer reads flag data from persistent storage for the
 * given context and returns it as a changeSet without a selector. This
 * allows the orchestrator to provide cached data immediately while
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
