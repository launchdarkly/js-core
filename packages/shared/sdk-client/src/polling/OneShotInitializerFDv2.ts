import {
  DataSourceErrorKind,
  httpErrorMessage,
  internal,
  LDLogger,
  LDPollingError,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';
import Requestor from '../datasource/Requestor';
import { Flag } from '../types';

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
    this._requestor.requestPayload().then((res) => {
      if (this._stopped) {
        return;
      }

      try {
        const parsed = JSON.parse(res) as internal.FDv2EventsCollection;
        const payloadProcessor = new internal.PayloadProcessor(
          {
            flag: (flag: Flag) => flag, // we don't need to do any extra processing on the flag
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
          dataCallback(payload.basis, payload);
        });

        payloadProcessor.processEvents(parsed.events);

        statusCallback(subsystemCommon.DataSourceState.Closed);
      } catch (error: any) {
        // We could not parse this JSON. Report the problem.
        this._logger?.error('Response contained invalid data');
        this._logger?.debug(`${error} - Body follows: ${res}`);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in polling response'),
        );
      }
    }).catch((err) => {
      if (this._stopped) {
        return;
      }

      const { status } = err;
      const message = httpErrorMessage(err, 'initializer', 'initializer does not retry');
      this._logger?.error(message);
      statusCallback(
        subsystemCommon.DataSourceState.Closed,
        new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
      );
    })
  }

  stop() {
    this._stopped = true;
  }
}
