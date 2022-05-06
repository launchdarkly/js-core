/**
 * The LaunchDarkly client feature flag requestor
 *
 * The client uses this internally to retrieve feature flags from LaunchDarkly.
 *
 * @ignore
 */

export interface LDFeatureRequestor {
  requestObject: (
    kind: any,
    key: string,
    cb: (err: any, body: any) => void
  ) => void;
  requestAllData: (cb: (err: any, body: any) => void) => void;
}
