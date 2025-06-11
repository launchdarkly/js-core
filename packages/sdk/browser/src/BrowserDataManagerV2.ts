import {
  BaseDataManager,
  BaseDataManagerV2,
  Configuration,
  Context,
  DataSourceErrorKind,
  DataSourcePaths,
  DataSourceState,
  FlagManager,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  makeRequestor,
  Platform,
  subsystem,
} from '@launchdarkly/js-client-sdk-common';

import { readFlagsFromBootstrap } from './bootstrap';
import { BrowserIdentifyOptions } from './BrowserIdentifyOptions';
import { ValidatedOptions } from './options';

const logTag = '[BrowserDataManager]';

export default class BrowserDataManagerV2 extends BaseDataManagerV2 {
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
      this._finishIdentifyFromBootstrap(context, browserIdentifyOptions.bootstrap, identifyResolve);
    } else {
      if (await this.flagManager.loadCached(context)) {
        this._debugLog(
          'Identify - Flags loaded from cache. Continuing to initialize via datasource.',
        );
      }

      try {
        await new Promise<void>((resolve, reject) => {
          this._setupConnection(context, resolve, reject, true);
        });
        identifyResolve();
      } catch (error: any) {
        identifyReject(error);
      }
    }
  }

  // private async _finishIdentifyFromPoll(
  //   context: Context,
  //   identifyResolve: () => void,
  //   identifyReject: (err: Error) => void,
  // ) {
  //   try {
  //     this.dataSourceStatusManager.requestStateUpdate(DataSourceState.Initializing);

  //     const plainContextString = JSON.stringify(Context.toLDContext(context));
  //     const pollingRequestor = makeRequestor(
  //       plainContextString,
  //       this.config.serviceEndpoints,
  //       this.getPollingPaths(),
  //       this.platform.requests,
  //       this.platform.encoding!,
  //       this.baseHeaders,
  //       [],
  //       this.config.withReasons,
  //       this.config.useReport,
  //       this._secureModeHash,
  //     );

  //     const payload = await pollingRequestor.requestPayload();
  //     try {
  //       const listeners = this.createStreamListeners(context, identifyResolve);
  //       const putListener = listeners.get('put');
  //       putListener!.processJson(putListener!.deserializeData(payload));
  //     } catch (e: any) {
  //       this.dataSourceStatusManager.reportError(
  //         DataSourceErrorKind.InvalidData,
  //         e.message ?? 'Could not parse poll response',
  //       );
  //     }
  //   } catch (e: any) {
  //     this.dataSourceStatusManager.reportError(
  //       DataSourceErrorKind.NetworkError,
  //       e.message ?? 'unexpected network error',
  //       e.status,
  //     );
  //     identifyReject(e);
  //   }
  // }

  private _finishIdentifyFromBootstrap(
    context: Context,
    bootstrap: unknown,
    identifyResolve: () => void,
  ) {
    this.flagManager.setBootstrap(context, readFlagsFromBootstrap(this.logger, bootstrap));
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

    // TODO: this section of code should eventually just enabled/disable the streaming synchronizer in the composite data source

    // const shouldBeStreaming =
    //   this._forcedStreaming ||
    //   (this._automaticStreamingState && this._forcedStreaming === undefined);

    // this._debugLog(
    //   `Updating streaming state. forced(${this._forcedStreaming}) automatic(${this._automaticStreamingState})`,
    // );

    // if (shouldBeStreaming) {
    //   this._startDataSource();
    // } else {
    //   this._stopDataSource();
    // }
  }

  private _stopDataSource() {
    if (this.dataSource) {
      this._debugLog('Stopping data source.');
    }
    this.dataSource?.stop();
    this.dataSource = undefined;
  }

  private _startDataSource() {
    if (this.dataSource) {
      this._debugLog('Data source already active. Not changing state.');
      return;
    }

    if (!this.context) {
      this._debugLog('Context not set, not starting data source.');
      return;
    }

    this._debugLog('Starting data source.');
    this._setupConnection(this.context);
  }

  private _setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
    withInitializer?: boolean,
  ) {
    this.dataSource?.stop();

    const rawContext = Context.toLDContext(context)!; // TODO: I don't think this is what we want.
    const plainContextString = JSON.stringify(Context.toLDContext(context));

    const initializers: subsystem.LDDataSourceFactory[] = [];
    const synchronizers: subsystem.LDDataSourceFactory[] = [];

    const requestor = makeRequestor(
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

    if (withInitializer) {
      initializers.push(this.createOneShotDataSourceFactory(rawContext, context, requestor));
    }

    // synchronizers.push(this.createStreamingDataSourceFactory(
    //   rawContext,
    //   context,
    //   requestor,
    // ))

    this.createCompositeDataSource(initializers, synchronizers);

    const payloadListener = this.createPayloadListener(
      rawContext,
      context,
      this.logger,
      identifyResolve,
    );

    this.dataSource!.start(
      (_, payload) => {
        payloadListener(payload);
      },
      (state, err) => {
        // TODO: hook up status reporting to data source status manager.
        // Existing data source status manager has comment that says...
        //
        // don't go to interrupted from initializing (recoverable errors when initializing are not noteworthy)
        //
        // This may contradict the logic in _wrapStatusCallbackWithSanitizer in the composite data source.  Need to reconcile
        // this.

        if (state === subsystem.DataSourceState.Closed && err) {
          this.emitter.emit('error', context, err);

          // TODO: update this as part of hooking up status reporting to data source status manager.
          // this._dataSourceEventHandler.handleStreamingError(err);

          identifyReject?.(err);
        }
      },
      () => undefined, // TODO: implement selector
    );
  }
}
