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

        // When the fallback directive rides along on a 200 response with a valid payload,
        // the directive must be applied atomically with the data callback. CompositeData-
        // Source disables its callback handler as soon as basis-during-init arrives, so a
        // separate status callback emitted afterwards would be silently dropped. Instead,
        // attach a fallbackToFDv1 marker to the data object: CompositeDataSource will swap
        // its synchronizer list to FDv1 before resolving the switchToSync transition.
        payloadProcessor.addPayloadListener((payload) => {
          const data: { initMetadata: any; payload: any; fallbackToFDv1?: boolean } = {
            initMetadata,
            payload,
          };
          if (fallbackToFDv1) {
            data.fallbackToFDv1 = true;
            this._logger?.warn(`Response header indicates to fallback to FDv1`);
          }
          dataCallback(payload.type === 'full', data);
        });

        payloadProcessor.processEvents(parsed.events);

        // The fallback directive (if any) was already attached to the data callback above,
        // so CompositeDataSource has already taken over the transition. Just close out.
        statusCallback(subsystemCommon.DataSourceState.Closed);
      } catch (parseError: any) {
        // We could not parse this JSON. Report the problem.
        this._logger?.error('Response contained invalid data');
        this._logger?.debug(`${parseError} - Body follows: ${body}`);
        if (fallbackToFDv1) {
          // Even when the accompanying body could not be parsed, the directive must still
          // be honored so we don't get stuck retrying FDv2 indefinitely. No payload was
          // applied here so we can use the status callback path safely.
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
