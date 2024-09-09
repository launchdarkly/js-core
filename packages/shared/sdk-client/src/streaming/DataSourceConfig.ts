import { ApplicationTags, Encoding, Info, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

export interface DataSourceConfig {
  credential: string;
  serviceEndpoints: ServiceEndpoints;
  info: Info;
  tags?: ApplicationTags;
  withReasons: boolean;
  useReport: boolean;
}

export interface StreamingDataSourceConfig extends DataSourceConfig {
  initialRetryDelayMillis: number;
  paths: StreamingPaths;
}

export interface StreamingPaths {
  pathGet(encoding: Encoding, credential: string, plainContextString: string): string;
  pathReport(encoding: Encoding, credential: string, plainContextString: string): string;
}
