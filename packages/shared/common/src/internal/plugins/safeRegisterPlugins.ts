import { LDPluginBase, LDPluginEnvironmentMetadata } from '../../api/integrations/plugins';
import { LDLogger } from '../../api/logging/LDLogger';
import { safeGetName } from './safeGetName';

export function safeRegisterPlugins<TClient, THook>(
  logger: LDLogger,
  environmentMetadata: LDPluginEnvironmentMetadata,
  client: TClient,
  plugins: LDPluginBase<TClient, THook>[],
): void {
  function copyMetadata() {
    const environmentMetadataCopy: LDPluginEnvironmentMetadata = {
      sdk: { ...environmentMetadata.sdk },
    };
    if (environmentMetadata.application) {
      environmentMetadataCopy.application = { ...environmentMetadata.application };
    }
    if (environmentMetadata.clientSideId) {
      environmentMetadataCopy.clientSideId = environmentMetadata.clientSideId;
    }
    if (environmentMetadata.mobileKey) {
      environmentMetadataCopy.mobileKey = environmentMetadata.mobileKey;
    }
    if (environmentMetadata.sdkKey) {
      environmentMetadataCopy.sdkKey = environmentMetadata.sdkKey;
    }
    return environmentMetadataCopy;
  }
  plugins.forEach((plugin) => {
    try {
      plugin.register(client, copyMetadata());
    } catch (error) {
      logger.error(`Exception thrown registering plugin ${safeGetName(logger, plugin)}.`);
    }
  });
}
