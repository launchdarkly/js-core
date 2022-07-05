import Configuration from '../options/Configuration';
import { Info } from '../platform';

export default function defaultHeaders(
  sdkKey: string,
  config: Configuration,
  info: Info,
): { [key: string]: string | string[] } {
  const headers: { [key: string]: string | string[] } = {
    authorization: sdkKey,
    'user-agent': `NodeJSClient/${info.sdkData().version}`,
  };

  if (config.wrapperName) {
    headers['x-launchdarkly-wrapper'] = config.wrapperVersion
      ? `${config.wrapperName}/${config.wrapperVersion}`
      : config.wrapperName;
  }

  const tags = config.tags.value;
  if (tags) {
    headers['x-launchdarkly-tags'] = tags;
  }

  return headers;
}
