import {
  DataSourceErrorKind,
  httpErrorMessage,
  HttpErrorResponse,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import Requestor, { LDRequestError } from '../datasource/Requestor';
import { Flags } from '../types';

export type PollingErrorHandler = (err: LDPollingError) => void;

function reportClosed(logger?: LDLogger) {
  logger?.debug(`Poll completed after the processor was closed. Skipping processing.`);
}

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private _stopped = false;

  private _timeoutHandle: any;

  constructor(
    private readonly _requestor: Requestor,
    private readonly _pollIntervalSeconds: number,
    private readonly _dataHandler: (flags: Flags) => void,
    private readonly _errorHandler?: PollingErrorHandler,
    private readonly _logger?: LDLogger,
  ) {}

  private async _poll() {
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

    this._logger?.debug('Polling LaunchDarkly for feature flag updates');
    const startTime = Date.now();
    try {
      const res = await this._requestor.requestPayload();
      try {
        // If the processor has been stopped, we discard the response.
        // This response could be for a no longer active context.
        if (this._stopped) {
          reportClosed(this._logger);
          return;
        }
        const flags = JSON.parse(res);
        try {
          this._dataHandler?.(flags);
        } catch (err) {
          this._logger?.error(`Exception from data handler: ${err}`);
        }
      } catch {
        reportJsonError(res);
      }
    } catch (err) {
      // If the processor has been stopped, we discard this error.
      // The original caller would consider this connection no longer active.
      if (this._stopped) {
        reportClosed(this._logger);
        return;
      }
      const requestError = err as LDRequestError;
      if (requestError.status !== undefined) {
        if (!isHttpRecoverable(requestError.status)) {
          this._logger?.error(httpErrorMessage(err as HttpErrorResponse, 'polling request'));
          this._errorHandler?.(
            new LDPollingError(
              DataSourceErrorKind.ErrorResponse,
              requestError.message,
              requestError.status,
            ),
          );
          return;
        }
      }
      this._logger?.error(
        httpErrorMessage(err as HttpErrorResponse, 'polling request', 'will retry'),
      );
    }

    const elapsed = Date.now() - startTime;
    const sleepFor = Math.max(this._pollIntervalSeconds * 1000 - elapsed, 0);

    this._logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);

    this._timeoutHandle = setTimeout(() => {
      this._poll();
    }, sleepFor);
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
