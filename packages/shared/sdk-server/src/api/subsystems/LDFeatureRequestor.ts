/**
 * The LaunchDarkly client feature flag requestor
 *
 * The client uses this internally to retrieve feature flags from LaunchDarkly.
 *
 * @param cb The callback invoked with the result of the request. The fourth argument,
 * `fallbackToFDv1`, is `true` when the response carried the `x-ld-fd-fallback: true`
 * header, regardless of whether the response was otherwise successful. Callers must
 * apply any accompanying body/headers before honoring the fallback signal.
 * @param queryParams Additional query params that will be included with the request. Values passed into this
 * function should already be encoded as this function will not perform encoding.
 * @ignore
 */
export interface LDFeatureRequestor {
  requestAllData: (
    cb: (err: any, body: any, headers: any, fallbackToFDv1?: boolean) => void,
    queryParams?: { key: string; value: string }[],
  ) => void;
}
