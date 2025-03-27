import {
  DataSourceErrorKind,
  httpErrorMessage,
  LDLogger,
  LDPollingError,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { deserializePoll } from '../store';
import VersionedDataKinds from '../store/VersionedDataKinds';
import Requestor from './Requestor';

/**
 * @internal
 */
export default class OneShotInitializer implements subsystemCommon.DataSystemInitializer {
  constructor(
    private readonly _requestor: Requestor,
    private readonly _logger?: LDLogger,
  ) {}

  /**
   * May be called any number of times, if already started, has no effect
   * @param dataCallback that will be called when data arrives, may be called multiple times.
   * @param statusCallback that will be called when data source state changes or an unrecoverable error
   * has been encountered.
   */
  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    statusCallback(subsystemCommon.DataSourceState.Initializing);

    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    console.log(this._requestor._headers);

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
      }

      const parsed = deserializePoll(body);
      if (!parsed) {
        // We could not parse this JSON. Report the problem and fallthrough to
        // start another poll.
        this._logger?.error('Initialization response contained invalid data');
        this._logger?.debug(`Invalid JSON follows: ${body}`);
        statusCallback(
          subsystemCommon.DataSourceState.Closed,
          new LDPollingError(
            DataSourceErrorKind.InvalidData,
            'Malformed JSON data in polling response',
          ),
        );
      } else {
        const initData = {
          [VersionedDataKinds.Features.namespace]: parsed.flags,
          [VersionedDataKinds.Segments.namespace]: parsed.segments,
        };

        // TODO: need to transform this into a payload

        dataCallback(true, initData);
        statusCallback(subsystemCommon.DataSourceState.Closed);
      }
    });
  }

  stop() {
    // TODO: at the moment no way to cancel the inflight request via the requester API, but could
    // be added in the future.
  }
}
