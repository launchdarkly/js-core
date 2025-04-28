import { LDPluginBase, LDPluginEnvironmentMetadata } from '../../api/integrations/plugins';
import { LDLogger } from '../../api/logging/LDLogger';
import { safeGetName } from './safeGetName';

export function safeRegisterPlugins<TClient, THook>(
  logger: LDLogger,
  environmentMetadata: LDPluginEnvironmentMetadata,
  client: TClient,
  plugins: LDPluginBase<TClient, THook>[],
): void {
  plugins.forEach((plugin) => {
    try {
      plugin.register(client, environmentMetadata);
    } catch (error) {
      logger.error(`Exception thrown registering plugin ${safeGetName(logger, plugin)}.`);
    }
  });
}
