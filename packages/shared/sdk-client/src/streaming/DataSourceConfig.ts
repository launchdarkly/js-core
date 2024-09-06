import { ApplicationTags, Encoding, Info } from '@launchdarkly/js-sdk-common';

export interface DataSourceConfig {
  credential: string;
  info: Info;
  tags?: ApplicationTags;
  withReasons: boolean;
  useReport: boolean;
}

export interface StreamingDataSourceConfig extends DataSourceConfig {
  initialRetryDelayMillis: number;
  streamingEndpoint: string;
  paths: StreamingPaths;
}

export interface StreamingPaths {
  pathGet(encoding: Encoding, credential: string, plainContextString: string): string;
  pathReport(encoding: Encoding, credential: string, plainContextString: string): string;
}
