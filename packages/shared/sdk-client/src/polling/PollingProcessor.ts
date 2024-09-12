import {
  ApplicationTags,
  defaultHeaders,
  getPollingUri,
  httpErrorMessage,
  HttpErrorResponse,
  Info,
  isHttpRecoverable,
  LDHeaders,
  LDLogger,
  LDPollingError,
  Requests,
  ServiceEndpoints,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { Flags } from '../types';
import Requestor, { LDRequestError } from './Requestor';

export type PollingErrorHandler = (err: LDPollingError) => void;

/**
 * Subset of configuration required for polling.
 *
 * @internal
 */
export type PollingConfig = {
  logger: LDLogger;
  pollInterval: number;
  tags: ApplicationTags;
  useReport: boolean;
  serviceEndpoints: ServiceEndpoints;
};

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private stopped = false;

  private logger?: LDLogger;

  private pollInterval: number;

  private timeoutHandle: any;

  private requestor: Requestor;

  constructor(
    requests: Requests,
    uriPath: string,
    parameters: { key: string; value: string }[],
    config: PollingConfig,
    baseHeaders: LDHeaders,
    private readonly dataHandler: (flags: Flags) => void,
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    const uri = getPollingUri(config.serviceEndpoints, uriPath, parameters);
    this.logger = config.logger;
    this.pollInterval = config.pollInterval;

    this.requestor = new Requestor(requests, uri, config.useReport, baseHeaders);
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
