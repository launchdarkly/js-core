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

    const reportJsonError = (data: string) => {
      this._logger?.error('Polling received invalid data');
      this._logger?.debug(`Invalid JSON follows: ${data}`);
      statusCallback(
        subsystemCommon.DataSourceState.Interrupted,
        new LDPollingError(
          DataSourceErrorKind.InvalidData,
          'Malformed JSON data in polling response',
        ),
      );
    };

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
        this._logger?.warn(httpErrorMessage(err, 'polling request', 'will retry'));
      } else if (body) {
        try {
          const parsed = JSON.parse(body) as internal.EventsSummary;

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

          this._timeoutHandle = setTimeout(() => {
            this._poll(dataCallback, statusCallback);
          }, sleepFor);
          return;
        } catch {
          // We could not parse this JSON. Report the problem and fallthrough to
          // start another poll.
          reportJsonError(body);
        }
      }

      // Falling through, there was some type of error and we need to trigger
      // a new poll.
      this._timeoutHandle = setTimeout(() => {
        this._poll(dataCallback, statusCallback);
      }, sleepFor);
    });
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    this._poll(dataCallback, statusCallback);
  }

  stop() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = undefined;
    }
    this._stopped = true;
  }

  close() {
    this.stop();
  }
}
