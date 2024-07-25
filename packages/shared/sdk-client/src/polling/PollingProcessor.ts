import {
  ClientContext,
  defaultHeaders,
  httpErrorMessage,
  isHttpRecoverable,
  LDLogger,
  LDPollingError,
  Requests,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { Flags } from '../types';

export type PollingErrorHandler = (err: LDPollingError) => void;

function isOk(status: number) {
  return status >= 200 && status <= 299;
}

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private readonly headers: { [key: string]: string };
  private stopped = false;

  private logger?: LDLogger;

  private pollInterval: number;

  private timeoutHandle: any;

  private requests: Requests;
  private uri: string;

  constructor(
    sdkKey: string,
    clientContext: ClientContext,
    uriPath: string,
    config: Configuration,
    private readonly dataHandler: (flags: Flags) => void,
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger, tags } = basicConfiguration;
    const { info, requests } = platform;
    this.uri = `${basicConfiguration.serviceEndpoints.polling}${uriPath}`;

    this.logger = logger;
    this.requests = requests;
    this.pollInterval = config.pollInterval;
    this.headers = defaultHeaders(sdkKey, info, tags);
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
        method: 'GET',
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
      } else if (!isHttpRecoverable(res.status)) {
        const message = httpErrorMessage(
          {
            message: `Unexpected status code: ${res.status}`,
            status: res.status,
          },
          'polling request',
        );
        this.logger?.error(message);
        this.errorHandler?.(new LDPollingError(message, res.status));
        // It is not recoverable, return and do not trigger another
        // poll.
        return;
      } else {
        // TODO: Better.
        // Recoverable error.
        this.logger?.error('Recoverable error', res.status);
      }
    } catch (err) {
      // TODO: Something.
      this.logger?.error('[Polling] Error:', err);
    }

    const elapsed = Date.now() - startTime;
    const sleepFor = Math.max(this.pollInterval * 1000 - elapsed, 0);

    this.logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);

    // Falling through, there was some type of error and we need to trigger
    // a new poll.
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
