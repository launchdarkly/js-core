import {
  BaseDataManager,
  Configuration,
  Context,
  DataSourceErrorKind,
  DataSourcePaths,
  DataSourceState,
  FlagManager,
  getPollingUri,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  Platform,
  Requestor,
} from '@launchdarkly/js-client-sdk-common';

import { ValidatedOptions } from './options';

const logTag = '[BrowserDataManager]';

export default class BrowserDataManager extends BaseDataManager {
  // If streaming is forced on or off, then we follow that setting.
  // Otherwise we automatically manage streaming state.
  private forcedStreaming?: boolean = undefined;
  private automaticStreamingState: boolean = false;

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
    private readonly browserConfig: ValidatedOptions,
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
    this.forcedStreaming = browserConfig.streaming;
  }

  private debugLog(message: any, ...args: any[]) {
    this.logger.debug(`${logTag} ${message}`, ...args);
  }

  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    _identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    if (await this.flagManager.loadCached(context)) {
      this.debugLog('Identify - Flags loaded from cache. Continuing to initialize via a poll.');
    }
    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const requestor = this.getRequestor(plainContextString);

    // TODO: Handle wait for network results in a meaningful way. SDK-707

    try {
      this.dataSourceStatusManager.requestStateUpdate(DataSourceState.Initializing);
      const payload = await requestor.requestPayload();
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

    this.updateStreamingState();
  }

  setForcedStreaming(streaming?: boolean) {
    this.forcedStreaming = streaming;
    this.updateStreamingState();
  }

  setAutomaticStreamingState(streaming: boolean) {
    this.automaticStreamingState = streaming;
    this.updateStreamingState();
  }

  private updateStreamingState() {
    const shouldBeStreaming =
      this.forcedStreaming || (this.automaticStreamingState && this.forcedStreaming === undefined);

    this.debugLog(
      `Updating streaming state. forced(${this.forcedStreaming}) automatic(${this.automaticStreamingState})`,
    );

    if (shouldBeStreaming) {
      this.startDataSource();
    } else {
      this.stopDataSource();
    }
  }

  private stopDataSource() {
    if (this.updateProcessor) {
      this.debugLog('Stopping update processor.');
    }
    this.updateProcessor?.close();
    this.updateProcessor = undefined;
  }

  private startDataSource() {
    if (this.updateProcessor) {
      this.debugLog('Update processor already active. Not changing state.');
      return;
    }

    if (!this.context) {
      this.debugLog('Context not set, not starting update processor.');
      return;
    }

    this.debugLog('Starting update processor.');
    this.setupConnection(this.context);
  }

  private setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;

    this.updateProcessor?.close();
    this.createStreamingProcessor(rawContext, context, identifyResolve, identifyReject);

    this.updateProcessor!.start();
  }

  private getRequestor(plainContextString: string): Requestor {
    const paths = this.getPollingPaths();
    const path = this.config.useReport
      ? paths.pathReport(this.platform.encoding!, plainContextString)
      : paths.pathGet(this.platform.encoding!, plainContextString);

    const parameters: { key: string; value: string }[] = [];
    if (this.config.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    const headers: { [key: string]: string } = { ...this.baseHeaders };
    let body;
    let method = 'GET';
    if (this.config.useReport) {
      method = 'REPORT';
      headers['content-type'] = 'application/json';
      body = plainContextString; // context is in body for REPORT
    }

    const uri = getPollingUri(this.config.serviceEndpoints, path, parameters);
    return new Requestor(this.platform.requests, uri, headers, method, body);
  }
}
