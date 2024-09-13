import { Encoding, HttpErrorResponse, Info } from '../api';
import { isHttpRecoverable } from '../errors';
import { ApplicationTags } from '../options';

export type LDHeaders = {
  authorization?: string;
  'user-agent'?: string;
  'x-launchdarkly-user-agent'?: string;
  'x-launchdarkly-wrapper'?: string;
  'x-launchdarkly-tags'?: string;
};

export function defaultHeaders(
  sdkKey: string,
  info: Info,
  tags?: ApplicationTags,
  includeAuthorizationHeader: boolean = true,
  userAgentHeaderName: 'user-agent' | 'x-launchdarkly-user-agent' = 'user-agent',
): LDHeaders {
  const { userAgentBase, version, wrapperName, wrapperVersion } = info.sdkData();

  const headers: LDHeaders = {
    [userAgentHeaderName]: `${userAgentBase ?? 'NodeJSClient'}/${version}`,
  };

  // edge sdks sets this to false because they use the clientSideID
  // and they don't need the authorization header
  if (includeAuthorizationHeader) {
    headers.authorization = sdkKey;
  }

  if (wrapperName) {
    headers['x-launchdarkly-wrapper'] = wrapperVersion
      ? `${wrapperName}/${wrapperVersion}`
      : wrapperName;
  }

  if (tags?.value) {
    headers['x-launchdarkly-tags'] = tags.value;
  }

  return headers;
}

export function httpErrorMessage(
  err: HttpErrorResponse,
  context: string,
  retryMessage?: string,
): string {
  let desc;
  if (err.status) {
    desc = `error ${err.status}${err.status === 401 ? ' (invalid SDK key)' : ''}`;
  } else {
    desc = `I/O error (${err.message || 'unknown error'})`;
  }
  const action = retryMessage ?? 'giving up permanently';
  return `Received ${desc} for ${context} - ${action}`;
}

export function shouldRetry({ status }: HttpErrorResponse) {
  return status ? isHttpRecoverable(status) : true;
}

/**
 * In react-native use base64-js to polyfill btoa. This is safe
 * because the react-native repo uses it too. Set the global.btoa to the encode
 * function of base64-js.
 * https://github.com/beatgammit/base64-js
 * https://github.com/axios/axios/issues/2235#issuecomment-512204616
 *
 * Ripped from https://thewoods.blog/base64url/
 */
export const base64UrlEncode = (s: string, encoding: Encoding): string =>
  encoding.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
