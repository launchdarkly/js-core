import type { KVNamespace } from '@cloudflare/workers-types';

import type { LDClient, LDOptions } from '@launchdarkly/cloudflare-server-sdk';
import { BasicLogger, init } from '@launchdarkly/cloudflare-server-sdk';
import { BaseOpenFeatureProvider } from '@launchdarkly/openfeature-js-server-common';

/**
 * An OpenFeature provider for the LaunchDarkly Cloudflare server SDK.
 */
export default class LaunchDarklyProvider extends BaseOpenFeatureProvider<LDClient> {
  /**
   * Construct a {@link LaunchDarklyProvider}.
   * @param clientSideID The client side ID. This is only used to query the kvNamespace below,
   * not to connect with LaunchDarkly servers.
   * @param kvNamespace The Cloudflare KV namespace configured for LaunchDarkly.
   * @param options Any options for the SDK.
   */
  constructor(clientSideID: string, kvNamespace: KVNamespace, options: LDOptions = {}) {
    super({
      logger: options.logger ?? BasicLogger.get(),
      providerName: 'launchdarkly-cloudflare-provider',
    });

    // no ConfigurationChanged wiring: the KV-backed client has no update notifications to surface
    try {
      const client = init(clientSideID, kvNamespace, options);
      this.setClient(client);
    } catch (e) {
      this.setClientError(e);
    }
  }
}
