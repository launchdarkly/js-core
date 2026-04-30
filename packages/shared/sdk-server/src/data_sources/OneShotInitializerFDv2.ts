import {
  DataSourceErrorKind,
  httpErrorMessage,
  internal,
  LDFlagDeliveryFallbackError,
  LDLogger,
  LDPollingError,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';
import Requestor from './Requestor';

/**
 * @internal
 */
export default class OneShotInitializerFDv2 implements subsystemCommon.DataSource {
  private _stopped = false;

  constructor(
    private readonly _requestor: Requestor,
    private readonly _logger?: LDLogger,
  ) {}

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    statusCallback(subsystemCommon.DataSourceState.Initializing);

    this._logger?.debug('Performing initialization request to LaunchDarkly for feature flag data.');
    this._requestor.requestAllData((err, body, headers, fallbackToFDv1) => {
      if (this._stopped) {
        return;
      }

      // Helper used to emit the FDv1 fallback signal once any accompanying payload has been
      // applied. Callers should `return` immediately after invoking it.
      const emitFallback = () => {
        const status = err?.status;
        const message = err
          ? httpErrorMessage(err, 'initializer', 'falling back to FDv1')
          : `Response header indicates to fallback to FDv1`;
        this._logger?.warn(message);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDFlagDeliveryFallbackError(DataSourceErrorKind.ErrorResponse, message, status),
        );
      };

      if (err) {
        // An error response can still carry the fallback directive. Emit the directive in
        // that case so the CompositeDataSource can hand off to the FDv1 synchronizer.
        if (fallbackToFDv1) {
          emitFallback();
          return;
        }

        const { status } = err;
        const message = httpErrorMessage(err, 'initializer', 'initializer does not retry');
        this._logger?.error(message);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
        );
        return;
      }

      if (!body) {
        if (fallbackToFDv1) {
          emitFallback();
          return;
        }
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(
            DataSourceErrorKind.InvalidData,
            'One shot initializer response missing body.',
          ),
        );
        return;
      }

      const initMetadata = internal.initMetadataFromHeaders(headers);

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

        statusCallback(subsystemCommon.DataSourceState.Valid);

        payloadProcessor.addPayloadListener((payload) => {
          dataCallback(payload.type === 'full', { initMetadata, payload });
        });

        payloadProcessor.processEvents(parsed.events);

        // Any accompanying payload has been applied. Honor the fallback directive (if any)
        // before declaring the initializer Closed so the composite swaps to FDv1.
        if (fallbackToFDv1) {
          emitFallback();
          return;
        }
        statusCallback(subsystemCommon.DataSourceState.Closed);
      } catch (parseError: any) {
        // We could not parse this JSON. Report the problem.
        this._logger?.error('Response contained invalid data');
        this._logger?.debug(`${parseError} - Body follows: ${body}`);
        if (fallbackToFDv1) {
          // Even when the accompanying body could not be parsed, the directive must still
          // be honored so we don't get stuck retrying FDv2 indefinitely.
          emitFallback();
          return;
        }
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in polling response'),
        );
      }
    });
  }

  stop() {
    this._stopped = true;
  }
}
