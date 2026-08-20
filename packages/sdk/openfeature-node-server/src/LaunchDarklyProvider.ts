import type { LDClient, LDOptions } from '@launchdarkly/node-server-sdk';
import { basicLogger, init } from '@launchdarkly/node-server-sdk';
import { BaseOpenFeatureProvider } from '@launchdarkly/openfeature-js-server-common';

/**
 * An OpenFeature provider for the LaunchDarkly Server-Side SDK for Node.js.
 */
export default class LaunchDarklyProvider extends BaseOpenFeatureProvider<LDClient> {
  private _dataSourceFailed = false;

  /**
   * Construct a {@link LaunchDarklyProvider}.
   * @param sdkKey The SDK key.
   * @param options Any options for the SDK.
   * @param initTimeoutSeconds The default amount of time to wait for initialization in seconds.
   * Defaults to 10 seconds.
   */
  constructor(sdkKey: string, options: LDOptions = {}, initTimeoutSeconds: number = 10) {
    super({
      logger: options.logger ?? basicLogger({ level: 'info' }),
      providerName: 'launchdarkly-node-provider',
      initTimeoutSeconds,
    });

    try {
      const client = init(sdkKey, {
        ...options,
        wrapperName: 'open-feature-node-server',
        wrapperVersion: '1.3.7', // x-release-please-version
      });

      this.setClient(client);

      // Receiving flag data means the client can receive updates again. The Node SDK has no other
      // signal that the data source recovered.
      client.on('update', ({ key }: { key: string }) => {
        if (this._dataSourceFailed) {
          this._dataSourceFailed = false;
          this.emitReady();
        }
        this.emitConfigurationChanged(key);
      });

      // A failure before initialization completes is reported by initialize rejecting, so only
      // failures of an initialized client need an event.
      client.on('failed', (err: Error) => {
        if (client.initialized()) {
          this._dataSourceFailed = true;
          this.emitError(`The LaunchDarkly client encountered an error: ${err.message}`);
        }
      });
    } catch (e) {
      this.setClientError(e);
    }
  }
}
