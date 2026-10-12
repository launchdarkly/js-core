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

  /**
   * When true, the event processor is constructed without starting its periodic
   * background work (the flush and context-deduplication interval timers, and the
   * diagnostic timer when diagnostics are enabled). Events are still recorded and
   * are delivered only via explicit flush() calls.
   *
   * This is intended for per-request edge SDKs that flush explicitly (for example
   * via a runtime's waitUntil) and must not leave interval timers running. A live
   * interval timer keeps the runtime event loop alive and roots the whole client
   * graph in memory, which for a per-request client is a leak.
   */
  disableBackgroundEventFlush?: boolean;
}
