import {
  DataSourceErrorKind,
  httpErrorMessage,
  internal,
  isHttpRecoverable,
  LDFlagDeliveryFallbackError,
  LDLogger,
  LDPollingError,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { FlagsAndSegments, processFlag, processSegment } from '../store/serialization';
import Requestor from './Requestor';
import { PayloadProcessor } from '@launchdarkly/js-sdk-common/dist/esm/internal';

export type PollingErrorHandler = (err: LDPollingError) => void;

/**
 * @internal
 */
export default class PollingProcessorFDv2 implements subsystemCommon.DataSource {
  private _stopped = false;
  private _timeoutHandle: any;

  private _statusCallback?: (status: subsystemCommon.DataSourceState, err?: any) => void;

  /**
   * @param _requestor to fetch flags from cloud services
   * @param _pollInterval in seconds controlling how frequently polling request is made
   * @param _logger for logging
   * @param _processResponseAsFDv1 defaults to false, but if set to true, this data source will process
   * the response body as FDv1 and convert it into a FDv2 payload.
   */
  constructor(
    private readonly _requestor: Requestor,
    private readonly _pollInterval: number = 30,
    private readonly _logger?: LDLogger,
    private readonly _processResponseAsFDv1: boolean = false,
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
        // this is a short term error and will be removed once FDv2 adoption is sufficient.
        if (err instanceof LDFlagDeliveryFallbackError) {
          this._logger?.error(err.message);
          statusCallback(subsystemCommon.DataSourceState.Closed, err);
          // It is not recoverable, return and do not trigger another poll.
          return;
        }

        if (status && !isHttpRecoverable(status)) {
          const message = httpErrorMessage(err, 'polling request');
          this._logger?.error(message);
          statusCallback(
            subsystemCommon.DataSourceState.Closed,
            new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status, false),
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
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(
            DataSourceErrorKind.ErrorResponse,
            'Response missing body, will retry.',
          ),
        );
        // schedule poll
        this._timeoutHandle = setTimeout(() => {
          this._poll(dataCallback, statusCallback);
        }, sleepFor);
        return;
      }

      try {
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

        if (!this._processResponseAsFDv1) {
          // FDv2 case
          const parsed = JSON.parse(body) as internal.FDv2EventsCollection;
          payloadProcessor.processEvents(parsed.events);
        } else {
          // FDv1 case
          const parsed = JSON.parse(body) as FlagsAndSegments;
          this._processFDv1FlagsAndSegments(payloadProcessor, parsed);
        }

        // TODO: SDK-855 implement blocking duplicate data source state events in DataAvailability API
        statusCallback(subsystemCommon.DataSourceState.Valid);
      } catch {
        // We could not parse this JSON. Report the problem and fallthrough to
        // start another poll.
        this._logger?.error('Response contained invalid data');
        this._logger?.debug(`${err} - Body follows: ${body}`);
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in polling response'),
        );
      }

      // schedule poll
      this._timeoutHandle = setTimeout(() => {
        this._poll(dataCallback, statusCallback);
      }, sleepFor);
    });
  }

  // helper function to transform FDv1 response data into events the PayloadProcessor can parse
  private _processFDv1FlagsAndSegments(payloadProcessor: PayloadProcessor, data: FlagsAndSegments) {
    payloadProcessor.processEvents([
      {
        event: `server-intent`,
        data: {
          payloads: [
            {
              id: `FDv1Fallback`,
              target: 0,
              code: `xfer-full`,
            },
          ],
        },
      },
    ]);

    Object.values(data?.flags || []).forEach((flag) => {
      payloadProcessor.processEvents([
        {
          event: `put-object`,
          data: {
            kind: 'flag',
            key: flag.key,
            version: flag.version,
            object: flag,
          },
        },
      ]);
    });

    Object.values(data?.segments || []).forEach((segment) => {
      payloadProcessor.processEvents([
        {
          event: `put-object`,
          data: {
            kind: 'segment',
            key: segment.key,
            version: segment.version,
            object: segment,
          },
        },
      ]);
    });

    payloadProcessor.processEvents([
      {
        event: `payload-transferred`,
        data: {
          state: `FDv1Fallback`,
          version: 0,
        },
      },
    ]);
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
