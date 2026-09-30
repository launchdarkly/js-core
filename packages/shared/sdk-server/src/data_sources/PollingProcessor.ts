import {
  classifyHttpStatus,
  classifyTransportFailure,
  FailureKind,
  forPolling,
  httpErrorMessage,
  internal,
  LDLogger,
  LDPollingError,
  RetryState,
  subsystem,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../api/subsystems';
import { deserializePoll } from '../store';
import VersionedDataKinds from '../store/VersionedDataKinds';
import Requestor from './Requestor';

export type PollingErrorHandler = (err: LDPollingError) => void;

const { initMetadataFromHeaders } = internal;

/**
 * @internal
 */
export default class PollingProcessor implements subsystem.LDStreamProcessor {
  private _stopped = false;
  private readonly _retryState: RetryState;

  private _timeoutHandle: any;

  constructor(
    private readonly _requestor: Requestor,
    private readonly _pollInterval: number,
    private readonly _featureStore: LDDataSourceUpdates,
    private readonly _logger?: LDLogger,
    private readonly _initSuccessHandler: VoidFunction = () => {},
    // Reserved for a future terminal-failure channel; intentionally unused
    // today
    private readonly _errorHandler?: PollingErrorHandler,
  ) {
    this._retryState = forPolling(1000 * this._pollInterval);
  }

  private _scheduleNextPoll() {
    const delay = this._retryState.nextDelay;
    this._logger?.debug('Scheduling next poll in %d ms', delay);
    this._timeoutHandle = setTimeout(() => {
      this._poll();
    }, delay);
  }

  private _poll() {
    if (this._stopped) {
      return;
    }

    this._logger?.debug('Polling LaunchDarkly for feature flag updates');
    this._requestor.requestAllData((err, body, headers) => {
      if (this._stopped) {
        return;
      }

      if (err) {
        const { status } = err;
        const kind: FailureKind =
          status !== undefined ? classifyHttpStatus(status) : classifyTransportFailure();
        this._retryState.recordFailure(kind);
        const message = httpErrorMessage(err, 'polling request', 'will retry');
        // No failure is terminal now, so this is surfaced as a log only — the
        // same outward treatment the SDK has always given a recoverable poll
        // failure. The error-event channel stays reserved for a terminal case.
        if (kind === 'unexpected') {
          this._logger?.error(message);
        } else {
          this._logger?.warn(message);
        }
        this._scheduleNextPoll();
        return;
      }

      if (body) {
        let parsed;
        try {
          parsed = deserializePoll(body);
        } catch {
          // Structurally invalid data can throw during deserialization; treat
          // it the same as the unparseable payload handled below.
          parsed = undefined;
        }
        if (!parsed) {
          // Unusable data is a normal failure: record it, report it, and poll
          // again after the resulting wait.
          this._retryState.recordFailure('normal');
          this._logger?.error('Polling received invalid data');
          this._logger?.debug(`Invalid JSON follows: ${body}`);
          this._scheduleNextPoll();
          return;
        }

        const initData = {
          [VersionedDataKinds.Features.namespace]: parsed.flags,
          [VersionedDataKinds.Segments.namespace]: parsed.segments,
        };
        this._featureStore.init(
          initData,
          () => {
            this._retryState.recordSuccess();
            this._initSuccessHandler();
            // Triggering the next poll after the init has completed.
            this._scheduleNextPoll();
          },
          initMetadataFromHeaders(headers),
        );
        return;
      }

      // No error and no body (for example, a not-modified response): a
      // successful poll that delivered nothing new.
      this._retryState.recordSuccess();
      this._scheduleNextPoll();
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
