import { ApplicationTags, Info } from '@launchdarkly/js-sdk-common';

export interface DefaultHeaderOptions {
  tags: ApplicationTags;
}

export default function defaultHeaders(
  sdkKey: string,
  config: DefaultHeaderOptions,
  info: Info,
): { [key: string]: string } {
  const sdkData = info.sdkData();
  const headers: { [key: string]: string } = {
    'user-agent': `${sdkData.userAgentBase ? sdkData.userAgentBase : 'NodeJSClient'}/${
      sdkData.version
    }`,
  };

  // edge sdks use clientSideID and don't need the authorization header
  if (sdkKey.startsWith('sdk-')) {
    headers.authorization = sdkKey;
  }

  if (sdkData.wrapperName) {
    headers['x-launchdarkly-wrapper'] = sdkData.wrapperVersion
      ? `${sdkData.wrapperName}/${sdkData.wrapperVersion}`
      : sdkData.wrapperName;
  }

  const tags = config.tags.value;
  if (tags) {
    headers['x-launchdarkly-tags'] = tags;
  }

  return headers;
}
