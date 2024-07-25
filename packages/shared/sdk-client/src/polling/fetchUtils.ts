import {
  base64UrlEncode,
  defaultHeaders,
  Encoding,
  Info,
  LDContext,
  Options,
} from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

export const createFetchPath = (
  sdkKey: string,
  context: LDContext,
  baseUrlPolling: string,
  useReport: boolean,
  encoding: Encoding,
) =>
  useReport
    ? `${baseUrlPolling}/sdk/evalx/${sdkKey}/context`
    : `${baseUrlPolling}/sdk/evalx/${sdkKey}/contexts/${base64UrlEncode(
        JSON.stringify(context),
        encoding,
      )}`;

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

export const createFetchUrl = (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  encoding: Encoding,
) => {
  const {
    withReasons,
    hash,
    serviceEndpoints: { polling },
    useReport,
  } = config;
  const path = createFetchPath(sdkKey, context, polling, useReport, encoding);
  const qs = createQueryString(hash, withReasons);

  return qs ? `${path}?${qs}` : path;
};

export const createFetchOptions = (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  info: Info,
): Options => {
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
