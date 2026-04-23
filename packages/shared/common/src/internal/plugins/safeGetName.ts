import { LDPluginBase } from '../../api/integrations/plugins';
import { LDLogger } from '../../api/logging/LDLogger';

const UNKNOWN_PLUGIN_NAME = 'unknown plugin';

export function safeGetName<TClient, THook>(
  logger: LDLogger,
  plugin: LDPluginBase<TClient, THook>,
) {
  try {
    return plugin.getMetadata().name || UNKNOWN_PLUGIN_NAME;
  } catch {
    logger.error(`Exception thrown getting metadata for plugin. Unable to get plugin name.`);
    return UNKNOWN_PLUGIN_NAME;
  }
}
