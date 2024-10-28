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
  // Returns the path to get flag data via GET request
  pathGet(encoding: Encoding, plainContextString: string): string;
  // Returns the path to get flag data via REPORT request
  pathReport(encoding: Encoding, plainContextString: string): string;
  // Returns the path to get ping stream notifications when flag data changes
  pathPing(encoding: Encoding, plainContextString: string): string;
}
