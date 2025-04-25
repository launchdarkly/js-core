import { LDPluginBase, LDPluginEnvironmentMetadata } from '../../api/integrations/plugins';
import { LDLogger } from '../../api/logging/LDLogger';
import { safeGetName } from './safeGetName';

export function safeGetHooks<TClient, THook>(
  logger: LDLogger,
  environmentMetadata: LDPluginEnvironmentMetadata,
  plugins: LDPluginBase<TClient, THook>[],
): THook[] {
  const hooks: THook[] = [];
  plugins.forEach((plugin) => {
    try {
      const pluginHooks = plugin.getHooks?.(environmentMetadata);
      if (pluginHooks && pluginHooks.length > 0) {
        hooks.push(...pluginHooks);
      }
    } catch (error) {
      logger.error(
        `Exception thrown getting hooks for plugin ${safeGetName(logger, plugin)}. Unable to get hooks.`,
      );
    }
  });
  return hooks;
}
