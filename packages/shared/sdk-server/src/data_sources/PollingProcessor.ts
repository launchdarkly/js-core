import {
  DataSourceErrorKind,
  httpErrorMessage,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  subsystem,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../api/subsystems';
import Configuration from '../options/Configuration';
import { deserializePoll } from '../store';
import VersionedDataKinds from '../store/VersionedDataKinds';
import Requestor from './Requestor';
import { isPollingOptions, isStandardOptions } from '../api/options/LDDataSystemOptions';

export type PollingErrorHandler = (err: LDPollingError) => void;

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private _stopped = false;

  private _timeoutHandle: any;

  constructor(
    private readonly _requestor: Requestor,
    private readonly _pollInterval: number,
    private readonly _featureStore: LDDataSourceUpdates,
    private readonly _logger?: LDLogger,
    private readonly _initSuccessHandler: VoidFunction = () => {},
    private readonly _errorHandler?: PollingErrorHandler,
  ) {}

  private _poll() {
    if (this._stopped) {
      return;
    }

    const reportJsonError = (data: string) => {
      this._logger?.error('Polling received invalid data');
      this._logger?.debug(`Invalid JSON follows: ${data}`);
      this._errorHandler?.(
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
          this._errorHandler?.(
            new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
          );
          // It is not recoverable, return and do not trigger another
          // poll.
          return;
        }
        this._logger?.warn(httpErrorMessage(err, 'polling request', 'will retry'));
      } else if (body) {
        const parsed = deserializePoll(body);
        if (!parsed) {
          // We could not parse this JSON. Report the problem and fallthrough to
          // start another poll.
          reportJsonError(body);
        } else {
          const initData = {
            [VersionedDataKinds.Features.namespace]: parsed.flags,
            [VersionedDataKinds.Segments.namespace]: parsed.segments,
          };
          this._featureStore.init(initData, () => {
            this._initSuccessHandler();
            // Triggering the next poll after the init has completed.
            this._timeoutHandle = setTimeout(() => {
              this._poll();
            }, sleepFor);
          });
          // The poll will be triggered by  the feature store initialization
          // completing.
          return;
        }
      }

      // Falling through, there was some type of error and we need to trigger
      // a new poll.
      this._timeoutHandle = setTimeout(() => {
        this._poll();
      }, sleepFor);
    });
  }

  start() {
    this._poll();
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
