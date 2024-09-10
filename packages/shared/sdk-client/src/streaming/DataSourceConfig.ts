import { ApplicationTags, Encoding, Info, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

export interface DataSourceConfig {
  credential: string;
  serviceEndpoints: ServiceEndpoints;
  info: Info;
  tags: ApplicationTags;
  withReasons: boolean;
  useReport: boolean;
  paths: DataSourcePaths;
}

export interface PollingDataSourceConfig extends DataSourceConfig {
  pollInterval: number;
}

export interface StreamingDataSourceConfig extends DataSourceConfig {
  initialRetryDelayMillis: number;
}

export interface DataSourcePaths {
  pathGet(encoding: Encoding, credential: string, plainContextString: string): string;
  pathReport(encoding: Encoding, credential: string, plainContextString: string): string;
}
