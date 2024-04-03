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

  /**
   * Sets the default identify timeout in seconds.
   * If not specified, this is set to 5 seconds in LDClientImpl.constructor.
   * Mobile sdks should set this to 15 seconds.
   */
  defaultIdentifyTimeout?: number;
};
