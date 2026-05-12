import { internal, LDPluginEnvironmentMetadata } from '@launchdarkly/js-sdk-common';

import { Hook } from '../integrations';

export interface ServerInternalOptions extends internal.LDInternalOptions {
  getImplementationHooks?: (environmentMetadata: LDPluginEnvironmentMetadata) => Hook[];

  /**
   * Per-SDK-instance identifier sent as the `X-LaunchDarkly-Instance-Id` header on every
   * outbound request. The SDK that owns instance-id generation (e.g. the Node server SDK)
   * supplies this; SDKs that do not advertise instance-id support (edge SDKs) leave it
   * undefined and the header is omitted.
   */
  instanceId?: string;
}
