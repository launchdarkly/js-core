import {
  DataSourceErrorKind,
  httpErrorMessage,
  internal,
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
export default class OneShotInitializer implements subsystemCommon.DataSystemInitializer {
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
    this._requestor.requestAllData((err, body) => {
      if (err) {
        const { status } = err;
        const message = httpErrorMessage(err, 'initializer', 'will not retry');
        this._logger?.error(message);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
        );
        return;
      }

      if (!body) {
        this._logger?.error('Initialization response missing body');
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(DataSourceErrorKind.InvalidData, 'Polling response missing body'),
        );
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
      } catch {
        // We could not parse this JSON. Report the problem.
        this._logger?.error('Initialization response contained invalid data');
        this._logger?.debug(`Invalid JSON follows: ${body}`);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(
            DataSourceErrorKind.InvalidData,
            'Malformed JSON data in polling response',
          ),
        );
      }
    });
  }

  stop() {
    // no-op since requestor has no cancellation support
  }
}
