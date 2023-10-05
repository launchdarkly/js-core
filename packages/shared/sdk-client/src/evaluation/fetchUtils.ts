import { defaultHeaders, Info, LDContext } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

/**
 * Dom api usage: btoa.
 *
 * In react-native use base64-js to polyfill btoa. This is safe
 * because the react-native repo uses it too. Set the global.btoa to the encode
 * function of base64-js.
 * https://github.com/beatgammit/base64-js
 * https://github.com/axios/axios/issues/2235#issuecomment-512204616
 *
 * Ripped from https://thewoods.blog/base64url/
 */
export const base64UrlEncode = (url: string): string =>
  btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const createFetchPath = (
  sdkKey: string,
  context: LDContext,
  baseUrlPolling: string,
  useReport: boolean,
) =>
  useReport
    ? `${baseUrlPolling}/sdk/evalx/${sdkKey}/context`
    : `${baseUrlPolling}/sdk/evalx/${sdkKey}/contexts/${base64UrlEncode(JSON.stringify(context))}`;

export const createQueryString = (hash: string | undefined, withReasons: boolean) => {
  const qs = {
    h: hash,
    withReasons,
  };

  const qsArray: string[] = [];
  Object.entries(qs).forEach(([key, value]) => {
    if (value) {
      qsArray.push(`${key}=${value}`);
    }
  });

  return qsArray.join('&');
};

export const createFetchUrl = (sdkKey: string, context: LDContext, config: Configuration) => {
  const {
    withReasons,
    hash,
    serviceEndpoints: { polling },
    useReport,
  } = config;
  const path = createFetchPath(sdkKey, context, polling, useReport);
  const qs = createQueryString(hash, withReasons);

  return qs ? `${path}?${qs}` : path;
};

export const createFetchOptions = (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  info: Info,
): RequestInit => {
  const { useReport, tags } = config;
  const headers = defaultHeaders(sdkKey, info, tags);

  if (useReport) {
    return {
      method: 'REPORT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(context),
    };
  }

  return {
    method: 'GET',
    headers,
  };
};
