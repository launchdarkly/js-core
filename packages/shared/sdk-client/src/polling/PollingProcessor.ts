import {
  ApplicationTags,
  defaultHeaders,
  httpErrorMessage,
  HttpErrorResponse,
  Info,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  Requests,
  ServiceEndpoints,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { Flags } from '../types';

export type PollingErrorHandler = (err: LDPollingError) => void;

function isOk(status: number) {
  return status >= 200 && status <= 299;
}

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
  private readonly headers: { [key: string]: string };
  private stopped = false;

  private logger?: LDLogger;

  private pollInterval: number;

  private timeoutHandle: any;

  private uri: string;
  private verb: string;

  constructor(
    sdkKey: string,
    private requests: Requests,
    info: Info,
    uriPath: string,
    config: PollingConfig,
    private readonly dataHandler: (flags: Flags) => void,
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    this.uri = `${config.serviceEndpoints.polling}${uriPath}`;

    this.logger = config.logger;
    this.requests = requests;
    this.pollInterval = config.pollInterval;
    this.headers = defaultHeaders(sdkKey, info, config.tags);
    this.verb = config.useReport ? 'REPORT' : 'GET';
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
      const res = await this.requests.fetch(this.uri, {
        method: this.verb,
        headers: this.headers,
      });

      if (isOk(res.status)) {
        const body = await res.text();

        try {
          const flags = JSON.parse(body);
          this.dataHandler(flags);
        } catch {
          reportJsonError(body);
        }
      } else {
        const err = {
          message: `Unexpected status code: ${res.status}`,
          status: res.status,
        };
        if (!isHttpRecoverable(res.status)) {
          const message = httpErrorMessage(err, 'polling request');
          this.logger?.error(message);
          this.errorHandler?.(new LDPollingError(message, res.status));
          // It is not recoverable, return and do not trigger another
          // poll.
          return;
        }
        // Recoverable error.
        this.logger?.error(httpErrorMessage(err, 'polling request', 'will retry'));
      }
    } catch (err) {
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
