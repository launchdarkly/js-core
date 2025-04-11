import {
  DataSourceErrorKind,
  httpErrorMessage,
  internal,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';
import Requestor from './Requestor';

export type PollingErrorHandler = (err: LDPollingError) => void;

/**
 * @internal
 */
export default class PollingProcessorFDv2 implements subsystemCommon.DataSystemSynchronizer {
  private _stopped = false;
  private _timeoutHandle: any;

  private _statusCallback?: (status: subsystemCommon.DataSourceState, err?: any) => void;

  constructor(
    private readonly _requestor: Requestor,
    private readonly _pollInterval: number = 30,
    private readonly _logger?: LDLogger,
  ) {}

  private _poll(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    if (this._stopped) {
      return;
    }

    const startTime = Date.now();
    this._logger?.debug('Polling LaunchDarkly for feature flag updates');
    this._requestor.requestAllData((err, body) => {
      const elapsed = Date.now() - startTime;
      const sleepFor = Math.max(this._pollInterval * 1000 - elapsed, 0);

      this._logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);
      if (err) {
        const { status } = err;
        if (status && !isHttpRecoverable(status)) {
          const message = httpErrorMessage(err, 'polling request');
          this._logger?.error(message);
          statusCallback(
            subsystemCommon.DataSourceState.Interrupted,
            new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
          );
          // It is not recoverable, return and do not trigger another poll.
          return;
        }

        const message = httpErrorMessage(err, 'polling request', 'will retry');
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
        );
        this._logger?.warn(message);
        // schedule poll
        this._timeoutHandle = setTimeout(() => {
          this._poll(dataCallback, statusCallback);
        }, sleepFor);
        return;
      }

      if (!body) {
        this._logger?.warn('Response missing body, will retry.');
        // schedule poll
        this._timeoutHandle = setTimeout(() => {
          this._poll(dataCallback, statusCallback);
        }, sleepFor);
        return;
      }

      try {
        const parsed = JSON.parse(body) as internal.FDv2EventsCollection;
        const payloadProcessor = new internal.PayloadProcessor(
          {
            flag: (flag: Flag) => {
              processFlag(flag);
              return flag;
            },
            segment: (segment: Segment) => {
              processSegment(segment);
              return segment;
            },
          },
          (errorKind: DataSourceErrorKind, message: string) => {
            statusCallback(
              subsystemCommon.DataSourceState.Interrupted,
              new LDPollingError(errorKind, message),
            );
          },
          this._logger,
        );

        payloadProcessor.addPayloadListener((payload) => {
          dataCallback(payload.basis, payload);
        });

        payloadProcessor.processEvents(parsed.events);

        // TODO: SDK-855 implement blocking duplicate data source state events in DataAvailability API
        statusCallback(subsystemCommon.DataSourceState.Valid);
      } catch {
        // We could not parse this JSON. Report the problem and fallthrough to
        // start another poll.
        this._logger?.error('Polling received malformed data');
        this._logger?.debug(`Malformed JSON follows: ${body}`);
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(
            DataSourceErrorKind.InvalidData,
            'Malformed JSON data in polling response',
          ),
        );
      }

      // schedule poll
      this._timeoutHandle = setTimeout(() => {
        this._poll(dataCallback, statusCallback);
      }, sleepFor);
    });
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    this._statusCallback = statusCallback; // hold reference for usage in stop()
    statusCallback(subsystemCommon.DataSourceState.Initializing);
    this._poll(dataCallback, statusCallback);
  }

  stop() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = undefined;
    }
    this._statusCallback?.(subsystemCommon.DataSourceState.Closed);
    this._stopped = true;
    this._statusCallback = undefined;
  }
}
