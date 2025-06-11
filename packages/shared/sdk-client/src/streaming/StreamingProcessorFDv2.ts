import {
  DataSourceErrorKind,
  Encoding,
  EventSource,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDFlagDeliveryFallbackError,
  LDLogger,
  LDStreamingError,
  Requests,
  shouldRetry,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { StreamingDataSourceConfig } from '../datasource/DataSourceConfig';
import Requestor from '../datasource/Requestor';
import { Flag } from '../types';

class StreamingProcessorFDv2 implements subsystemCommon.DataSource {
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _streamUri: string;

  private _eventSource?: EventSource;
  private _connectionAttemptStartTime?: number;

  constructor(
    private readonly _plainContextString: string,
    private readonly _dataSourceConfig: StreamingDataSourceConfig,
    private readonly _requests: Requests,
    encoding: Encoding,
    private readonly _pingStreamRequestor: Requestor, // TODO: bring back ping stream support
    private readonly _diagnosticsManager?: internal.DiagnosticsManager,
    private readonly _logger?: LDLogger,
  ) {
    if (
      this._dataSourceConfig.useReport &&
      !this._requests.getEventSourceCapabilities().customMethod
    ) {
      this._streamUri = this._dataSourceConfig.paths.pathPing(encoding, _plainContextString);
    } else {
      this._streamUri = _dataSourceConfig.useReport
        ? _dataSourceConfig.paths.pathReport(encoding, _plainContextString)
        : _dataSourceConfig.paths.pathGet(encoding, _plainContextString);
    }

    this._requests = _requests;
    this._headers = { ..._dataSourceConfig.baseHeaders };
    this._logger = _logger;
  }

  private _logConnectionAttempt() {
    this._connectionAttemptStartTime = Date.now();
  }

  private _logConnectionResult(success: boolean) {
    if (this._connectionAttemptStartTime && this._diagnosticsManager) {
      this._diagnosticsManager.recordStreamInit(
        this._connectionAttemptStartTime,
        !success,
        Date.now() - this._connectionAttemptStartTime,
      );
    }

    this._connectionAttemptStartTime = undefined;
  }

  /**
   * This is a wrapper around the passed errorHandler which adds additional
   * diagnostics and logging logic.
   *
   * @param err The error to be logged and handled.
   * @return boolean whether to retry the connection.
   *
   * @private
   */
  private _retryAndHandleError(
    err: HttpErrorResponse,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    // this is a short term error and will be removed once FDv2 adoption is sufficient.
    if (err.headers?.[`x-ld-fd-fallback`] === `true`) {
      const fallbackErr = new LDFlagDeliveryFallbackError(
        DataSourceErrorKind.ErrorResponse,
        `Response header indicates to fallback to FDv1`,
        err.status,
      );
      statusCallback(subsystemCommon.DataSourceState.Closed, fallbackErr);
      return false;
    }

    if (!shouldRetry(err)) {
      this._logger?.error(httpErrorMessage(err, 'streaming request'));
      this._logConnectionResult(false);
      statusCallback(
        subsystemCommon.DataSourceState.Closed,
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status, false),
      );
      return false;
    }

    this._logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    this._logConnectionResult(false);
    this._logConnectionAttempt();
    statusCallback(subsystemCommon.DataSourceState.Interrupted);
    return true;
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
    selectorGetter?: () => string | undefined,
  ) {
    this._logConnectionAttempt();
    statusCallback(subsystemCommon.DataSourceState.Initializing);

    let methodAndBodyOverrides;
    if (this._dataSourceConfig.useReport) {
      // REPORT will include a body, so content type is required.
      this._headers['content-type'] = 'application/json';

      // orverrides default method with REPORT and adds body.
      methodAndBodyOverrides = { method: 'REPORT', body: this._plainContextString };
    } else {
      // no method or body override
      methodAndBodyOverrides = {};
    }

    const parameters: { key: string; value: string }[] = [
      ...(this._dataSourceConfig.queryParameters ?? []),
    ];
    if (this._dataSourceConfig.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    const selector = selectorGetter?.();
    if (selector) {
      parameters.push({ key: 'basis', value: selector });
    }

    const uriWithParams = getStreamingUri(
      this._dataSourceConfig.serviceEndpoints,
      this._streamUri,
      parameters,
    );
    this._logger?.debug(`Streaming processor opening event source to uri: ${uriWithParams}`);

    // TLS is handled by the platform implementation.
    const eventSource = this._requests.createEventSource(uriWithParams, {
      headers: this._headers, // adds content-type header required when body will be present
      ...methodAndBodyOverrides,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error, statusCallback),
      initialRetryDelayMillis: this._dataSourceConfig.initialRetryDelayMillis,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
    });
    this._eventSource = eventSource;
    const payloadReader = new internal.PayloadStreamReader(
      eventSource,
      {
        flag: (flag: Flag) => flag, // we don't need to do any extra processing on the flag
      },
      (errorKind: DataSourceErrorKind, message: string) => {
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDStreamingError(errorKind, message),
        );

        // parsing error was encountered, defensively close the data source
        this.stop();
      },
      this._logger,
    );
    payloadReader.addPayloadListener((payload) => {
      this._logConnectionResult(true);
      dataCallback(payload.basis, payload);
    });

    eventSource.onclose = () => {
      this._logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = () => {
      this._logger?.info('Opened LaunchDarkly stream connection');
    };

    eventSource.onretrying = (e) => {
      this._logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };

    // TODO: re-add ping stream handling, probably as an eventsource decorator so that payload
    // processing pipeline can hook into the poll response.
  }

  stop() {
    this._eventSource?.close();
    this._eventSource = undefined;
  }

  close() {
    this.stop();
  }
}

export default StreamingProcessorFDv2;
