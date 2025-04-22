/**
 * The LaunchDarkly client feature flag requestor
 *
 * The client uses this internally to retrieve feature flags from LaunchDarkly.
 *
 * @ignore
 */
export interface LDFeatureRequestor {
  requestAllData: (cb: (err: any, body: any, headers: any) => void) => void;
}
