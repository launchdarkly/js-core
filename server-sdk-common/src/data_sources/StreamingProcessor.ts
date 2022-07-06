import { LDLogger } from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '../api';
import { LDFeatureStore } from '../api/subsystems';
import { isHttpRecoverable, LDStreamingError } from '../errors';
import Configuration from '../options/Configuration';
import { EventSource, Info, Requests } from '../platform';
import { deserializeAll, deserializeDelete, deserializePatch } from '../store/serialization';
import VersionedDataKinds, { VersionedDataKind } from '../store/VersionedDataKinds';
import defaultHeaders from './defaultHeaders';
import httpErrorMessage from './httpErrorMessage';

const STREAM_READ_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_RESET_INTERVAL_MS = 60 * 1000;

function getKeyFromPath(kind: VersionedDataKind, path: string): string | undefined {
  return path.startsWith(kind.streamApiPath)
    ? path.substring(kind.streamApiPath.length)
    : undefined;
}

export default class StreamingProcessor implements LDStreamProcessor {
  private headers: { [key: string]: string | string[] };

  private eventSource?: EventSource;

  private logger?: LDLogger;

  private streamUri: string;

  private streamInitialReconnectDelay: number;

  private requests: Requests;

  private featureStore: LDFeatureStore;

  private connectionAttemptStartTime?: number;

  constructor(sdkKey: string, config: Configuration, requests: Requests, info: Info) {
    // TODO: Will need diagnostics manager.
    this.headers = defaultHeaders(sdkKey, config, info);
    this.logger = config.logger;
    this.streamInitialReconnectDelay = config.streamInitialReconnectDelay;
    this.requests = requests;
    this.featureStore = config.featureStore;

    this.streamUri = `${config.serviceEndpoints.streaming}/all`;
  }

  private logConnectionStarted() {
    this.connectionAttemptStartTime = new Date().getTime();
  }

  // TODO: Remove once the success is used for something.
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  private logConnectionResult(success: boolean) {
    // TODO: Implement. requires diagnosticsManager.

    this.connectionAttemptStartTime = undefined;
  }

  start(fn?: ((err?: any) => void) | undefined) {
    this.logConnectionStarted();

    const errorFilter = (err: {
      status: number,
      message: string
    }): boolean => {
      if (err.status && isHttpRecoverable(err.status)) {
        this.logConnectionResult(false);
        fn?.(new LDStreamingError(err.message, err.status));
        this.logger?.error(httpErrorMessage(err, 'streaming request'));
        return false;
      }

      this.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
      this.logConnectionResult(false);
      this.logConnectionStarted();
      return true;
    };

    const reportJsonError = (type: string, data: string) => {
      this.logger?.error(`Stream received invalid data in "${type}" message`);
      this.logger?.debug(`Invalid JSON follows: ${data}`);
      fn?.call(new LDStreamingError('Malformed JSON data in event stream'));
    };

    // TLS is handled by the platform implementation.

    const eventSource = this.requests.createEventSource(this.streamUri, {
      headers: this.headers,
      errorFilter,
      initialRetryDelayMillis: 1000 * this.streamInitialReconnectDelay,
      readTimeoutMillis: STREAM_READ_TIMEOUT_MS,
      retryResetIntervalMillis: RETRY_RESET_INTERVAL_MS,
    });
    this.eventSource = eventSource;

    eventSource.onclose = () => {
      this.logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = () => {
      this.logger?.info('Opened LaunchDarkly stream connection');
    };

    eventSource.onretrying = (e) => {
      this.logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };

    eventSource.addEventListener('put', (event) => {
      this.logger?.debug('Received put event');
      if (event && event.data) {
        this.logConnectionResult(true);
        const parsed = deserializeAll(event.data);
        if (!parsed) {
          reportJsonError('put', event.data);
          return;
        }
        const initData = {
          [VersionedDataKinds.Features.namespace]: parsed.data.flags,
          [VersionedDataKinds.Segments.namespace]: parsed.data.segments,
        };

        this.featureStore.init(initData, () => fn?.());
      } else {
        fn?.(new LDStreamingError('Unexpected payload from event stream'));
      }
    });

    eventSource.addEventListener('patch', (event) => {
      this.logger?.debug('Received patch event');
      if (event && event.data) {
        const parsed = deserializePatch(event.data);
        if (!parsed) {
          reportJsonError('patch', event.data);
          return;
        }
        if (parsed.kind) {
          const key = getKeyFromPath(parsed.kind, parsed.path);
          if (key) {
            this.logger?.debug(`Updating ${key} in ${parsed.kind.namespace}`);
            // TODO: The interface didn't specify the callback was optional,
            // but previously it was not included here. Need to resolve.
            this.featureStore.upsert(parsed.kind, parsed.data, () => { });
          }
        }
      } else {
        fn?.(new LDStreamingError('Unexpected payload from event stream'));
      }
    });

    eventSource.addEventListener('delete', (event) => {
      this.logger?.debug('Received delete event');
      if (event && event.data) {
        const parsed = deserializeDelete(event.data);
        if (!parsed) {
          reportJsonError('delete', event.data);
          return;
        }
        if (parsed.kind) {
          const key = getKeyFromPath(parsed.kind, parsed.path);
          if (key) {
            this.logger?.debug(`Deleting ${key} in ${parsed.kind.namespace}`);
            // TODO: The interface didn't specify the callback was optional,
            // but previously it was not included here. Need to resolve.
            this.featureStore.delete(parsed.kind, key, parsed.version, () => { });
          }
        }
      } else {
        fn?.(new LDStreamingError('Unexpected payload from event stream'));
      }
    });
  }

  stop() {
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  close() {
    this.stop();
  }
}
