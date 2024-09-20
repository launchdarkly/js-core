import {
  Configuration,
  Context,
  DataSourcePaths,
  DefaultDataManager,
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

export default class BrowserDataManager extends DefaultDataManager {
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
  override async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    _identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    await this.flagManager.loadCached(context);
    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const requestor = this.getRequestor(plainContextString);

    try {
      const payload = await requestor.requestPayload();
      const listeners = this.createStreamListeners(context, identifyResolve);
      const putListener = listeners.get('put');
      putListener!.processJson(putListener!.deserializeData(payload));
    } catch (e: any) {
      identifyReject(e);
    }

    if (this.browserConfig.stream) {
      this.setupConnection(context);
    }
  }

  stopDataSource() {
    this.updateProcessor?.close();
    this.updateProcessor = undefined;
  }

  startDataSource() {
    // Should always be streaming for browser SDKs for now.
    if (this.connectionMode !== 'streaming') {
      this.setConnectionMode('streaming');
    } else if (this.context && !this.updateProcessor) {
      this.setupConnection(this.context);
    }
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
