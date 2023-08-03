import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDStreamProcessor } from '../api';
import { LDDataSourceUpdates } from '../api/subsystems';
import { isHttpRecoverable, LDPollingError } from '../errors';
import Configuration from '../options/Configuration';
import { deserializePoll } from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';
import httpErrorMessage from './httpErrorMessage';
import Requestor from './Requestor';

/**
 * @internal
 */
export default class PollingProcessor implements LDStreamProcessor {
  private stopped = false;

  private logger?: LDLogger;

  private pollInterval: number;

  private timeoutHandle: any;

  constructor(
    config: Configuration,
    private readonly requestor: Requestor,
    private readonly featureStore: LDDataSourceUpdates,
  ) {
    this.logger = config.logger;
    this.pollInterval = config.pollInterval;
    this.featureStore = featureStore;
  }

  private poll(fn?: ((err?: any) => void) | undefined) {
    if (this.stopped) {
      return;
    }

    const reportJsonError = (data: string) => {
      this.logger?.error('Polling received invalid data');
      this.logger?.debug(`Invalid JSON follows: ${data}`);
      fn?.(new LDPollingError('Malformed JSON data in polling response'));
    };

    const startTime = Date.now();
    this.logger?.debug('Polling LaunchDarkly for feature flag updates');
    this.requestor.requestAllData((err, body) => {
      const elapsed = Date.now() - startTime;
      const sleepFor = Math.max(this.pollInterval * 1000 - elapsed, 0);

      this.logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);
      if (err) {
        if (err.status && !isHttpRecoverable(err.status)) {
          const message = httpErrorMessage(err, 'polling request');
          this.logger?.error(message);
          fn?.(new LDPollingError(message));
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
            [VersionedDataKinds.ConfigurationOverrides.namespace]:
              parsed.configurationOverrides || {},
            [VersionedDataKinds.Metrics.namespace]: parsed.metrics || {},
          };
          this.featureStore.init(initData, () => {
            fn?.();
            // Triggering the next poll after the init has completed.
            this.timeoutHandle = setTimeout(() => {
              this.poll(fn);
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
        this.poll(fn);
      }, sleepFor);
    });
  }

  start(fn?: ((err?: any) => void) | undefined) {
    this.poll(fn);
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
