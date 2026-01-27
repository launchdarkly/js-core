import {
  BaseDataManager,
  Configuration,
  Context,
  DataSourceErrorKind,
  DataSourcePaths,
  DataSourceState,
  FlagManager,
  httpErrorMessage,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  makeRequestor,
  Platform,
  shouldRetry,
  sleep,
} from '@launchdarkly/js-client-sdk-common';

import { readFlagsFromBootstrap } from './bootstrap';
import { BrowserIdentifyOptions } from './BrowserIdentifyOptions';
import { ValidatedOptions } from './options';

const logTag = '[BrowserDataManager]';

export default class BrowserDataManager extends BaseDataManager {
  // If streaming is forced on or off, then we follow that setting.
  // Otherwise we automatically manage streaming state.
  private _forcedStreaming?: boolean = undefined;
  private _automaticStreamingState: boolean = false;
  private _secureModeHash?: string;

  // +-----------+-----------+---------------+
  // |  forced   | automatic |     state     |
  // +-----------+-----------+---------------+
  // | true      | false     | streaming     |
  // | true      | true      | streaming     |
  // | false     | true      | not streaming |
  // | false     | false     | not streaming |
  // | undefined | true      | streaming     |
  // | undefined | false     | not streaming |
  // +-----------+-----------+---------------+

  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    private readonly _browserConfig: ValidatedOptions,
    getPollingPaths: () => DataSourcePaths,
    getStreamingPaths: () => DataSourcePaths,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    diagnosticsManager?: internal.DiagnosticsManager,
  ) {
    super(
      platform,
      flagManager,
      credential,
      config,
      getPollingPaths,
      getStreamingPaths,
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
    this._forcedStreaming = _browserConfig.streaming;
  }

  private _debugLog(message: any, ...args: any[]) {
    this.logger.debug(`${logTag} ${message}`, ...args);
  }

  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    if (this.closed) {
      this._debugLog('Identify called after data manager was closed.');
      return;
    }

    this.context = context;
    const browserIdentifyOptions = identifyOptions as BrowserIdentifyOptions | undefined;
    if (browserIdentifyOptions?.hash) {
      this.setConnectionParams({
        queryParameters: [{ key: 'h', value: browserIdentifyOptions.hash }],
      });
    } else {
      this.setConnectionParams();
    }
    this._secureModeHash = browserIdentifyOptions?.hash;

    if (browserIdentifyOptions?.bootstrap) {
      this._finishIdentifyFromBootstrap(context, browserIdentifyOptions, identifyResolve);
    } else {
      if (await this.flagManager.loadCached(context)) {
        this._debugLog('Identify - Flags loaded from cache. Continuing to initialize via a poll.');
      }

      await this._finishIdentifyFromPoll(context, identifyResolve, identifyReject);
    }
    this._updateStreamingState();
  }

  /**
   * A helper function for the initial poll request. This is mainly here to facilitate
   * the retry logic.
   *
   * @param context - LDContext to request payload for.
   * @returns Payload as a string.
   */
  private async _requestPayload(context: Context): Promise<string> {
    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const pollingRequestor = makeRequestor(
      plainContextString,
      this.config.serviceEndpoints,
      this.getPollingPaths(),
      this.platform.requests,
      this.platform.encoding!,
      this.baseHeaders,
      [],
      this.config.withReasons,
      this.config.useReport,
      this._secureModeHash,
    );

    // NOTE: We are currently hardcoding in 3 retries for the initial
    // poll. We can make this configurable in the future.
    const maxRetries = 3;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await pollingRequestor.requestPayload();
      } catch (e: any) {
        if (!shouldRetry(e)) {
          throw e;
        }
        lastError = e;
        // NOTE: current we are hardcoding the retry interval to 1 second.
        // We can make this configurable in the future.
        if (attempt < maxRetries) {
          this._debugLog(httpErrorMessage(e, 'initial poll request', 'will retry'));
          // eslint-disable-next-line no-await-in-loop
          await sleep(1000);
        }
      }
    }

    throw lastError;
  }

  private async _finishIdentifyFromPoll(
    context: Context,
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
  ) {
    try {
      this.dataSourceStatusManager.requestStateUpdate(DataSourceState.Initializing);

      const payload = await this._requestPayload(context);

      try {
        const listeners = this.createStreamListeners(context, identifyResolve);
        const putListener = listeners.get('put');
        putListener!.processJson(putListener!.deserializeData(payload));
      } catch (e: any) {
        this.dataSourceStatusManager.reportError(
          DataSourceErrorKind.InvalidData,
          e.message ?? 'Could not parse poll response',
        );
      }
    } catch (e: any) {
      this.dataSourceStatusManager.reportError(
        DataSourceErrorKind.NetworkError,
        e.message ?? 'unexpected network error',
        e.status,
      );
      identifyReject(e);
    }
  }

  private _finishIdentifyFromBootstrap(
    context: Context,
    browserIdentifyOptions: BrowserIdentifyOptions,
    identifyResolve: () => void,
  ) {
    let { bootstrapParsed } = browserIdentifyOptions;
    if (!bootstrapParsed) {
      bootstrapParsed = readFlagsFromBootstrap(this.logger, browserIdentifyOptions.bootstrap);
    }
    this.flagManager.setBootstrap(context, bootstrapParsed);
    this._debugLog('Identify - Initialization completed from bootstrap');
    identifyResolve();
  }

  setForcedStreaming(streaming?: boolean) {
    this._forcedStreaming = streaming;
    this._updateStreamingState();
  }

  setAutomaticStreamingState(streaming: boolean) {
    this._automaticStreamingState = streaming;
    this._updateStreamingState();
  }

  private _updateStreamingState() {
    const shouldBeStreaming =
      this._forcedStreaming ||
      (this._automaticStreamingState && this._forcedStreaming === undefined);

    this._debugLog(
      `Updating streaming state. forced(${this._forcedStreaming}) automatic(${this._automaticStreamingState})`,
    );

    if (shouldBeStreaming) {
      this._startDataSource();
    } else {
      this._stopDataSource();
    }
  }

  private _stopDataSource() {
    if (this.updateProcessor) {
      this._debugLog('Stopping update processor.');
    }
    this.updateProcessor?.close();
    this.updateProcessor = undefined;
  }

  private _startDataSource() {
    if (this.updateProcessor) {
      this._debugLog('Update processor already active. Not changing state.');
      return;
    }

    if (!this.context) {
      this._debugLog('Context not set, not starting update processor.');
      return;
    }

    this._debugLog('Starting update processor.');
    this._setupConnection(this.context);
  }

  private _setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;

    this.updateProcessor?.close();

    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const pollingRequestor = makeRequestor(
      plainContextString,
      this.config.serviceEndpoints,
      this.getPollingPaths(),
      this.platform.requests,
      this.platform.encoding!,
      this.baseHeaders,
      [],
      this.config.withReasons,
      this.config.useReport,
      this._secureModeHash,
    );

    this.createStreamingProcessor(
      rawContext,
      context,
      pollingRequestor,
      identifyResolve,
      identifyReject,
    );

    this.updateProcessor!.start();
  }
}
