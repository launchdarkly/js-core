import {
  DataSourceErrorKind,
  Encoding,
  getPollingUri,
  httpErrorMessage,
  HttpErrorResponse,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  Requests,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { PollingDataSourceConfig } from '../streaming/DataSourceConfig';
import { Flags } from '../types';
import Requestor, { LDRequestError } from './Requestor';

export type PollingErrorHandler = (err: LDPollingError) => void;

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private _stopped = false;

  private _pollInterval: number;

  private _timeoutHandle: any;

  private _requestor: Requestor;

  constructor(
    private readonly _plainContextString: string,
    private readonly _dataSourceConfig: PollingDataSourceConfig,
    requests: Requests,
    encoding: Encoding,
    private readonly _dataHandler: (flags: Flags) => void,
    private readonly _errorHandler?: PollingErrorHandler,
    private readonly _logger?: LDLogger,
  ) {
    const path = _dataSourceConfig.useReport
      ? _dataSourceConfig.paths.pathReport(encoding, _plainContextString)
      : _dataSourceConfig.paths.pathGet(encoding, _plainContextString);

    const parameters: { key: string; value: string }[] = [
      ...(_dataSourceConfig.queryParameters ?? []),
    ];
    if (this._dataSourceConfig.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    const uri = getPollingUri(_dataSourceConfig.serviceEndpoints, path, parameters);
    this._pollInterval = _dataSourceConfig.pollInterval;

    let method = 'GET';
    const headers: { [key: string]: string } = { ..._dataSourceConfig.baseHeaders };
    let body;
    if (_dataSourceConfig.useReport) {
      method = 'REPORT';
      headers['content-type'] = 'application/json';
      body = _plainContextString; // context is in body for REPORT
    }

    this._requestor = new Requestor(requests, uri, headers, method, body);
  }

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
    const sleepFor = Math.max(this._pollInterval * 1000 - elapsed, 0);

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
