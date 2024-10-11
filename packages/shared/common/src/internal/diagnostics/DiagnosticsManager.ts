import { Platform } from '../../api';
import { DiagnosticId, DiagnosticInitEvent, DiagnosticStatsEvent, StreamInitData } from './types';

export default class DiagnosticsManager {
  private readonly _startTime: number;
  private _streamInits: StreamInitData[] = [];
  private readonly _id: DiagnosticId;
  private _dataSinceDate: number;

  constructor(
    sdkKey: string,
    private readonly _platform: Platform,
    private readonly _diagnosticInitConfig: any,
  ) {
    this._startTime = Date.now();
    this._dataSinceDate = this._startTime;
    this._id = {
      diagnosticId: _platform.crypto.randomUUID(),
      sdkKeySuffix: sdkKey.length > 6 ? sdkKey.substring(sdkKey.length - 6) : sdkKey,
    };
  }

  /**
   * Creates the initial event that is sent by the event processor when the SDK starts up. This will
   * not be repeated during the lifetime of the SDK client.
   */
  createInitEvent(): DiagnosticInitEvent {
    const sdkData = this._platform.info.sdkData();
    const platformData = this._platform.info.platformData();

    return {
      kind: 'diagnostic-init',
      id: this._id,
      creationDate: this._startTime,
      sdk: sdkData,
      configuration: this._diagnosticInitConfig,
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
    this._streamInits.push(item);
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
      id: this._id,
      creationDate: currentTime,
      dataSinceDate: this._dataSinceDate,
      droppedEvents,
      deduplicatedUsers,
      eventsInLastBatch,
      streamInits: this._streamInits,
    };

    this._streamInits = [];
    this._dataSinceDate = currentTime;
    return evt;
  }
}
