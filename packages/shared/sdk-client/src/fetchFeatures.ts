import {
  ClientContext,
  defaultHeaders,
  Info,
  LDContext,
  Platform,
  PlatformData,
} from '@launchdarkly/js-sdk-common';

import Configuration from './configuration';
import { PlatformDom } from './platform/PlatformDom';

/**
 * TODO: refactor this into a separate file
 * Ripped from https://thewoods.blog/base64url/
 */
const base64UrlEncode = (url: string): string => {
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fetchFeatures = async (
  sdkKey: string,
  context: LDContext,
  config: Configuration,
  platform: Platform,
) => {
  const {
    evaluationReasons,
    hash,
    serviceEndpoints: { polling },
    useReport,
    tags,
  } = config;

  // TODO: refactor path building to a separate function
  const stringifiedContext = JSON.stringify(context);
  let fetchPath = `${polling}/sdk/evalx/${sdkKey}/context`;
  let body;

  if (useReport) {
    body = stringifiedContext;
  } else {
    fetchPath = `${fetchPath}s/${base64UrlEncode(stringifiedContext)}`;
  }

  // TODO: improve qs building
  const qsObject: any = {};
  if (hash) {
    qsObject.hash = hash;
  }
  if (evaluationReasons) {
    qsObject.withReasons = evaluationReasons;
  }
  const qs = new URLSearchParams(qsObject).toString();

  // TODO: error catching and retry
  const response = await fetch(`${fetchPath}?${qs}`, {
    method: useReport ? 'REPORT' : 'GET',
    headers: defaultHeaders(sdkKey, platform.info, tags),
    body,
  });
  const responseJson = await response.json();

  // TODO: parse json into strongly typed objects
};

export default fetchFeatures;
