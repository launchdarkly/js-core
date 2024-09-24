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

import { ValidatedOptions } from './options';

const logTag = '[BrowserDataManager]';

export default class BrowserDataManager extends BaseDataManager {
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
      const payload = await requestor.requestPayload();
      const listeners = this.createStreamListeners(context, identifyResolve);
      const putListener = listeners.get('put');
      putListener!.processJson(putListener!.deserializeData(payload));
    } catch (e: any) {
      identifyReject(e);
    }

    if (this.browserConfig.streaming) {
      this.setupConnection(context);
    }
  }

  stopDataSource() {
    this.updateProcessor?.close();
    this.updateProcessor = undefined;
  }

  startDataSource() {
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
  // TODO: Automatically start streaming if event handlers are registered.
}
