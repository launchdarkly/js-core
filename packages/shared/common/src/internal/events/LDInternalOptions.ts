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
};
