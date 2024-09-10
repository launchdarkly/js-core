import {
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
  private stopped = false;

  private pollInterval: number;

  private timeoutHandle: any;

  private requestor: Requestor;

  constructor(
    private readonly plainContextString: string,
    private readonly dataSourceConfig: PollingDataSourceConfig,
    requests: Requests,
    encoding: Encoding,
    private readonly dataHandler: (flags: Flags) => void,
    private readonly errorHandler?: PollingErrorHandler,
    private readonly logger?: LDLogger,
  ) {
    const path = dataSourceConfig.useReport
      ? dataSourceConfig.paths.pathReport(encoding, dataSourceConfig.credential, plainContextString)
      : dataSourceConfig.paths.pathGet(encoding, dataSourceConfig.credential, plainContextString);

    const parameters: { key: string; value: string }[] = [];
    if (this.dataSourceConfig.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    const uri = getPollingUri(dataSourceConfig.serviceEndpoints, path, parameters);
    this.pollInterval = dataSourceConfig.pollInterval;

    this.requestor = new Requestor(
      this.dataSourceConfig.credential,
      requests,
      this.dataSourceConfig.info,
      uri,
      this.dataSourceConfig.tags,
      this.dataSourceConfig.useReport ? 'REPORT' : 'GET',
      this.dataSourceConfig.useReport ? plainContextString : undefined, // context is in body for REPORT
    );
  }

  private async poll() {
    if (this.stopped) {
      return;
    }

    const reportJsonError = (data: string) => {
      this.logger?.error('Polling received invalid data');
      this.logger?.debug(`Invalid JSON follows: ${data}`);
      this.errorHandler?.(new LDPollingError('Malformed JSON data in polling response'));
    };

    this.logger?.debug('Polling LaunchDarkly for feature flag updates');
    const startTime = Date.now();
    try {
      const res = await this.requestor.requestPayload();
      try {
        const flags = JSON.parse(res);
        try {
          this.dataHandler?.(flags);
        } catch (err) {
          this.logger?.error(`Exception from data handler: ${err}`);
        }
      } catch {
        reportJsonError(res);
      }
    } catch (err) {
      const requestError = err as LDRequestError;
      if (requestError.status !== undefined) {
        if (!isHttpRecoverable(requestError.status)) {
          this.logger?.error(httpErrorMessage(err as HttpErrorResponse, 'polling request'));
          this.errorHandler?.(new LDPollingError(requestError.message, requestError.status));
          return;
        }
      }
      this.logger?.error(
        httpErrorMessage(err as HttpErrorResponse, 'polling request', 'will retry'),
      );
    }

    const elapsed = Date.now() - startTime;
    const sleepFor = Math.max(this.pollInterval * 1000 - elapsed, 0);

    this.logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);

    this.timeoutHandle = setTimeout(() => {
      this.poll();
    }, sleepFor);
  }

  start() {
    this.poll();
  }

  stop() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    this.stopped = true;
  }

  close() {
    this.stop();
  }
}
