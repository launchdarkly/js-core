/**
 * This is for internal use only.
 *
 * Edge sdks use clientSideID to query feature stores. They also send analytics
 * using this clientSideID. This is a hybrid behavior because they are based
 * on js-server-common, but uses the clientSideID instead of the sdkKey for the
 * above reasons. These internal options allow the edge sdks to use the
 * EventSender to send analytics to the correct LD endpoints using
 * the clientSideId.
 */
export type LDInternalOptions = {
  analyticsEventPath?: string;
  diagnosticEventPath?: string;
  includeAuthorizationHeader?: boolean;
  userAgentHeaderName?: 'user-agent' | 'x-launchdarkly-user-agent';

  /**
   * In seconds. Log a warning if identifyTimeout is greater than this value.
   *
   * Mobile - 15s.
   * Browser - 5s.
   * Server - 60s.
   */
  highTimeoutThreshold?: number;

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
};
