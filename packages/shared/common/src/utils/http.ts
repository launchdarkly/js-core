import { Info } from '../api';
import { ApplicationTags } from '../options';

export type LDHeaders = {
  authorization?: string;
  'user-agent': string;
  'x-launchdarkly-wrapper'?: string;
  'x-launchdarkly-tags'?: string;
};

export function defaultHeaders(
  sdkKey: string,
  info: Info,
  tags?: ApplicationTags,
  includeAuthorizationHeader: boolean = true,
): LDHeaders {
  const { userAgentBase, version, wrapperName, wrapperVersion } = info.sdkData();

  const headers: LDHeaders = {
    'user-agent': `${userAgentBase ?? 'NodeJSClient'}/${version}`,
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
  err: {
    status: number;
    message: string;
  },
  context: string,
  retryMessage?: string,
): string {
  let desc;
  if (err.status) {
    desc = `error ${err.status}${err.status === 401 ? ' (invalid SDK key)' : ''}`;
  } else {
    desc = `I/O error (${err.message || err})`;
  }
  const action = retryMessage ?? 'giving up permanently';
  return `Received ${desc} for ${context} - ${action}`;
}
