import { createSafeLogger } from '@launchdarkly/js-sdk-common';
import type { LDClient, LDOptions } from '@launchdarkly/node-server-sdk';
import { basicLogger, init } from '@launchdarkly/node-server-sdk';
import { BaseOpenFeatureProvider } from '@launchdarkly/openfeature-js-server-common';

/**
 * An OpenFeature provider for the LaunchDarkly Server-Side SDK for Node.js.
 */
export default class LaunchDarklyProvider extends BaseOpenFeatureProvider<LDClient> {
  /**
   * Construct a {@link LaunchDarklyProvider}.
   * @param sdkKey The SDK key.
   * @param options Any options for the SDK.
   * @param initTimeoutSeconds The default amount of time to wait for initialization in seconds.
   * Defaults to 10 seconds.
   */
  constructor(sdkKey: string, options: LDOptions = {}, initTimeoutSeconds: number = 10) {
    const logger = options.logger
      ? createSafeLogger(options.logger)
      : basicLogger({ level: 'info' });

    super({
      logger,
      providerName: 'launchdarkly-node-provider',
      initTimeoutSeconds,
    });

    try {
      const client = init(sdkKey, {
        ...options,
        wrapperName: 'open-feature-node-server',
        // The wrapper version should be kept on its own line to allow easy updates using
        // release-please.
        wrapperVersion: '1.2.0', // x-release-please-version
      });

      this.setClient(client);

      // Wire Node SDK update events to OpenFeature ConfigurationChanged events.
      client.on('update', ({ key }: { key: string }) => {
        this.emitConfigurationChanged(key);
      });
    } catch (e) {
      this.setClientError(e);
    }
  }
}
