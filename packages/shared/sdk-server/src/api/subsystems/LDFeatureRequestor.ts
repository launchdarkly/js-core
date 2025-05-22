/**
 * The LaunchDarkly client feature flag requestor
 *
 * The client uses this internally to retrieve feature flags from LaunchDarkly.
 *
 * @param cb The callback with error or information from the response if successful
 * @param queryParams Additional query params that will be included with the request. Values passed into this
 * function should already be encoded as this function will not perform encoding.
 * @ignore
 */
export interface LDFeatureRequestor {
  requestAllData: (
    cb: (err: any, body: any, headers: any) => void,
    queryParams?: { key: string; value: string }[],
  ) => void;
}
