export interface DiagnosticPlatformData {
  name?: string;
  osArch?: string;
  osName?: string;
  osVersion?: string;
  /**
   * Platform specific identifiers.
   * For instance `nodeVersion`
   */
  [key: string]: string | undefined;
}

export interface DiagnosticSdkData {
  name?: string;
  wrapperName?: string;
  wrapperVersion?: string;
}

export interface DiagnosticConfigData {
  customBaseURI: boolean;
  customStreamURI: boolean;
  customEventsURI: boolean;
  eventsCapacity: number;
  connectTimeoutMillis: number;
  socketTimeoutMillis: number;
  eventsFlushIntervalMillis: number;
  pollingIntervalMillis: number;
  // startWaitMillis: n/a (SDK does not have this feature)
  // samplingInterval: n/a (SDK does not have this feature)
  reconnectTimeMillis: number;
  streamingDisabled: boolean;
  usingRelayDaemon: boolean;
  offline: boolean;
  allAttributesPrivate: boolean;
  contextKeysCapacity: number;
  contextKeysFlushIntervalMillis: number;
  usingProxy: boolean;
  usingProxyAuthenticator: boolean;
  diagnosticRecordingIntervalMillis: number;
  dataStoreType: string;
}

export interface DiagnosticId {
  diagnosticId: string;
  sdkKeySuffix: string;
}

export interface DiagnosticInitEvent {
  kind: 'diagnostic-init';
  id: DiagnosticId;
  creationDate: number;
  sdk: DiagnosticSdkData;
  configuration: DiagnosticConfigData;
  platform: DiagnosticPlatformData;
}

export interface StreamInitData {
  timestamp: number;
  failed: boolean;
  durationMillis: number;
}

export interface DiagnosticStatsEvent {
  kind: 'diagnostic';
  id: DiagnosticId;
  creationDate: number;
  dataSinceDate: number;
  droppedEvents: number;
  deduplicatedUsers: number;
  eventsInLastBatch: number;
  streamInits: StreamInitData[];
}

export interface LDDiagnosticsManager {
  createInitEvent(): DiagnosticInitEvent;
  createStatsEventAndReset(
    droppedEvents: number,
    deduplicatedUsers: number,
    eventsInLastBatch: number,
  ): DiagnosticStatsEvent;
  recordStreamInit(timestamp: number, failed: boolean, durationMillis: number): void;
}
