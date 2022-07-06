import Configuration from '../options/Configuration';
import { Info } from '../platform';

export default function defaultHeaders(
  sdkKey: string,
  config: Configuration,
  info: Info,
): { [key: string]: string | string[] } {
  const sdkData = info.sdkData();
  const headers: { [key: string]: string | string[] } = {
    authorization: sdkKey,
    'user-agent': `NodeJSClient/${sdkData.version}`,
  };

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
