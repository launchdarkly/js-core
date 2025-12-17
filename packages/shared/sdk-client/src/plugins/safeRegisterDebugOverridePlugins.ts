import { internal, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDPluginBase } from '../api';
import { LDDebugOverride } from '../flag-manager/FlagManager';

/**
 * Safe register debug override plugins.
 *
 * @param logger The logger to use for logging errors.
 * @param debugOverride The debug override to register.
 * @param plugins The plugins to register.
 */
export function safeRegisterDebugOverridePlugins<TClient, THook>(
  logger: LDLogger,
  debugOverride: LDDebugOverride,
  plugins: LDPluginBase<TClient, THook>[],
): void {
  plugins.forEach((plugin) => {
    try {
      plugin.registerDebug?.(debugOverride);
    } catch (error) {
      logger.error(`Exception thrown registering plugin ${internal.safeGetName(logger, plugin)}.`);
    }
  });
}
