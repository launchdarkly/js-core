import {
  BaseDataManager,
  Configuration,
  Context,
  DataSourcePaths,
  FlagManager,
  getPollingUri,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  Platform,
  Requestor,
} from '@launchdarkly/js-client-sdk-common';

import { readFlagsFromBootstrap } from './bootstrap';
import { BrowserIdentifyOptions } from './BrowserIdentifyOptions';
import { ValidatedOptions } from './options';

const logTag = '[BrowserDataManager]';

export default class BrowserDataManager extends BaseDataManager {
  // If streaming is forced on or off, then we follow that setting.
  // Otherwise we automatically manage streaming state.
  private forcedStreaming?: boolean = undefined;
  private automaticStreamingState: boolean = false;
  private secureModeHash?: string;

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
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    const browserIdentifyOptions = identifyOptions as BrowserIdentifyOptions | undefined;
    if (browserIdentifyOptions?.hash) {
      this.setConnectionParams({
        queryParameters: [{ key: 'h', value: browserIdentifyOptions.hash }],
      });
    } else {
      this.setConnectionParams();
    }
    this.secureModeHash = browserIdentifyOptions?.hash;

    // TODO: Handle wait for network results in a meaningful way. SDK-707

    if (browserIdentifyOptions?.bootstrap) {
      this.finishIdentifyFromBootstrap(context, browserIdentifyOptions.bootstrap, identifyResolve);
    } else {
      if (await this.flagManager.loadCached(context)) {
        this.debugLog('Identify - Flags loaded from cache. Continuing to initialize via a poll.');
      }
      const plainContextString = JSON.stringify(Context.toLDContext(context));
      const requestor = this.getRequestor(plainContextString);
      await this.finishIdentifyFromPoll(requestor, context, identifyResolve, identifyReject);
    }

    this.updateStreamingState();
  }

  private async finishIdentifyFromPoll(
    requestor: Requestor,
    context: Context,
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
  ) {
    try {
      const payload = await requestor.requestPayload();
      const listeners = this.createStreamListeners(context, identifyResolve);
      const putListener = listeners.get('put');
      putListener!.processJson(putListener!.deserializeData(payload));
    } catch (e: any) {
      identifyReject(e);
    }
  }

  private finishIdentifyFromBootstrap(
    context: Context,
    bootstrap: unknown,
    identifyResolve: () => void,
  ) {
    this.flagManager.setBootstrap(context, readFlagsFromBootstrap(this.logger, bootstrap));
    this.debugLog('Identify - Initialization completed from bootstrap');
    identifyResolve();
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
    if (this.secureModeHash) {
      parameters.push({ key: 'h', value: this.secureModeHash });
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
