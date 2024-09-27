import { Encoding, LDHeaders, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

export interface DataSourceConfig {
  credential: string;
  serviceEndpoints: ServiceEndpoints;
  baseHeaders: LDHeaders;
  withReasons: boolean;
  useReport: boolean;
  paths: DataSourcePaths;
  queryParameters?: { key: string; value: string }[];
}

export interface PollingDataSourceConfig extends DataSourceConfig {
  pollInterval: number;
}

export interface StreamingDataSourceConfig extends DataSourceConfig {
  initialRetryDelayMillis: number;
}

export interface DataSourcePaths {
  pathGet(encoding: Encoding, plainContextString: string): string;
  pathReport(encoding: Encoding, plainContextString: string): string;
}
