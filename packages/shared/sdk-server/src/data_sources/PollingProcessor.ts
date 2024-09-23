import {
  httpErrorMessage,
  internal,
  isHttpRecoverable,
  LDLogger,
  subsystem,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../api/subsystems';
import Configuration from '../options/Configuration';
import { deserializePoll } from '../store';
import VersionedDataKinds from '../store/VersionedDataKinds';
import Requestor from './Requestor';

// TODO: revisit usage of internal and figure out best practice
const { DataSourceErrorKind, LDPollingError } = internal;
export type PollingErrorHandler = (err: internal.LDPollingError) => void;

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private stopped = false;

  private logger?: LDLogger;

  private pollInterval: number;

  private timeoutHandle: any;

  constructor(
    config: Configuration,
    private readonly requestor: Requestor,
    private readonly featureStore: LDDataSourceUpdates,
    private readonly initSuccessHandler: VoidFunction = () => {},
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    this.logger = config.logger;
    this.pollInterval = config.pollInterval;
  }

  private poll() {
    if (this.stopped) {
      return;
    }

    const reportJsonError = (data: string) => {
      this.logger?.error('Polling received invalid data');
      this.logger?.debug(`Invalid JSON follows: ${data}`);
      this.errorHandler?.(
        new LDPollingError(
          DataSourceErrorKind.InvalidData,
          'Malformed JSON data in polling response',
        ),
      );
    };

    const startTime = Date.now();
    this.logger?.debug('Polling LaunchDarkly for feature flag updates');
    this.requestor.requestAllData((err, body) => {
      const elapsed = Date.now() - startTime;
      const sleepFor = Math.max(this.pollInterval * 1000 - elapsed, 0);

      this.logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);
      if (err) {
        const { status } = err;
        if (status && !isHttpRecoverable(status)) {
          const message = httpErrorMessage(err, 'polling request');
          this.logger?.error(message);
          this.errorHandler?.(
            new LDPollingError(DataSourceErrorKind.ErrorResponse, message, status),
          );
          // It is not recoverable, return and do not trigger another
          // poll.
          return;
        }
        this.logger?.warn(httpErrorMessage(err, 'polling request', 'will retry'));
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
          this.featureStore.init(initData, () => {
            this.initSuccessHandler();
            // Triggering the next poll after the init has completed.
            this.timeoutHandle = setTimeout(() => {
              this.poll();
            }, sleepFor);
          });
          // The poll will be triggered by  the feature store initialization
          // completing.
          return;
        }
      }

      // Falling through, there was some type of error and we need to trigger
      // a new poll.
      this.timeoutHandle = setTimeout(() => {
        this.poll();
      }, sleepFor);
    });
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
