import { Platform } from '../../api';
import { DiagnosticId, DiagnosticInitEvent, DiagnosticStatsEvent, StreamInitData } from './types';

export default class DiagnosticsManager {
  private readonly startTime: number;
  private streamInits: StreamInitData[] = [];
  private readonly id: DiagnosticId;
  private dataSinceDate: number;

  constructor(
    sdkKey: string,
    private readonly platform: Platform,
    private readonly diagnosticInitConfig: any,
  ) {
    this.startTime = Date.now();
    this.dataSinceDate = this.startTime;
    this.id = {
      diagnosticId: platform.crypto.randomUUID(),
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
      configuration: this.diagnosticInitConfig,
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
    eventsInLastBatch: number,
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
