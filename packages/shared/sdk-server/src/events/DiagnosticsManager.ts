import { Platform } from '@launchdarkly/js-sdk-common';
import { LDFeatureStore } from '../api/subsystems';
import Configuration, { defaultValues } from '../options/Configuration';

interface DiagnosticPlatformData {
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

interface DiagnosticSdkData {
  name?: string;
  wrapperName?: string;
  wrapperVersion?: string;
}

interface DiagnosticConfigData {
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

interface DiagnosticId {
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

interface StreamInitData {
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

function secondsToMillis(sec: number): number {
  return Math.trunc(sec * 1000);
}

/**
 * Maintains information for diagnostic events.
 *
 * @internal
 */
export default class DiagnosticsManager {
  private startTime: number;

  private streamInits: StreamInitData[] = [];

  private id: DiagnosticId;

  private dataSinceDate: number;

  constructor(
    sdkKey: string,
    private readonly config: Configuration,
    private readonly platform: Platform,
    private readonly featureStore: LDFeatureStore
  ) {
    this.startTime = Date.now();
    this.dataSinceDate = this.startTime;
    this.id = {
      diagnosticId: platform.crypto.uuidv4(),
      sdkKeySuffix: sdkKey.length > 6 ? sdkKey.substring(sdkKey.length - 6) : sdkKey,
    };
  }

  /**
   * Creates the initial event that is sent by the event processor when the SDK starts up. This will
   * not be repeated during the lifetime of the SDK client.
   */
  createInitEvent(): DiagnosticInitEvent {
    const sdkData = this.platform.info.sdkData();
    const platformData = this.platform.info.platformData();

    return {
      kind: 'diagnostic-init',
      id: this.id,
      creationDate: this.startTime,
      sdk: sdkData,
      configuration: {
        customBaseURI: this.config.serviceEndpoints.polling !== defaultValues.baseUri,
        customStreamURI: this.config.serviceEndpoints.streaming !== defaultValues.streamUri,
        customEventsURI: this.config.serviceEndpoints.events !== defaultValues.eventsUri,
        eventsCapacity: this.config.eventsCapacity,
        // Node doesn't distinguish between these two kinds of timeouts. It is unlikely other web
        // based implementations would be able to either.
        connectTimeoutMillis: secondsToMillis(this.config.timeout),
        socketTimeoutMillis: secondsToMillis(this.config.timeout),
        eventsFlushIntervalMillis: secondsToMillis(this.config.flushInterval),
        pollingIntervalMillis: secondsToMillis(this.config.pollInterval),
        reconnectTimeMillis: secondsToMillis(this.config.streamInitialReconnectDelay),
        streamingDisabled: !this.config.stream,
        usingRelayDaemon: this.config.useLdd,
        offline: this.config.offline,
        allAttributesPrivate: this.config.allAttributesPrivate,
        contextKeysCapacity: this.config.contextKeysCapacity,
        contextKeysFlushIntervalMillis: secondsToMillis(this.config.contextKeysFlushInterval),
        usingProxy: !!this.platform.requests.usingProxy?.(),
        usingProxyAuthenticator: !!this.platform.requests.usingProxyAuth?.(),
        diagnosticRecordingIntervalMillis: secondsToMillis(this.config.diagnosticRecordingInterval),
        dataStoreType: this.featureStore.getDescription?.() ?? 'memory',
      },
      platform: {
        name: platformData.name,
        osArch: platformData.os?.arch,
        osName: platformData.os?.name,
        osVersion: platformData.os?.version,
        ...(platformData.additional || {}),
      },
    };
  }

  /**
   * Records a stream connection attempt (called by the stream processor).
   *
   * @param timestamp Time of the *beginning* of the connection attempt.
   * @param failed True if the connection failed, or we got a read timeout before receiving a "put".
   * @param durationMillis Elapsed time between starting timestamp and when we either gave up/lost
   * the connection or received a successful "put".
   */
  recordStreamInit(timestamp: number, failed: boolean, durationMillis: number) {
    const item = { timestamp, failed, durationMillis };
    this.streamInits.push(item);
  }

  /**
   * Creates a periodic event containing time-dependent stats, and resets the state of the manager
   * with regard to those stats.
   *
   * Note: the reason droppedEvents, deduplicatedUsers, and eventsInLastBatch are passed into this
   * function, instead of being properties of the DiagnosticsManager, is that the event processor is
   * the one who's calling this function and is also the one who's tracking those stats.
   */
  createStatsEventAndReset(
    droppedEvents: number,
    deduplicatedUsers: number,
    eventsInLastBatch: number
  ): DiagnosticStatsEvent {
    const currentTime = Date.now();
    const evt: DiagnosticStatsEvent = {
      kind: 'diagnostic',
      id: this.id,
      creationDate: currentTime,
      dataSinceDate: this.dataSinceDate,
      droppedEvents,
      deduplicatedUsers,
      eventsInLastBatch,
      streamInits: this.streamInits,
    };

    this.streamInits = [];
    this.dataSinceDate = currentTime;
    return evt;
  }
}
