import {
  Configuration,
  Context,
  createDataSourceStatusManager,
  createFDv2DataSource,
  createPollingInitializer,
  createPollingSynchronizer,
  createStreamingBase,
  createStreamingSynchronizer,
  createSynchronizerSlot,
  DataManager,
  DataSourceStatusManager,
  FDv2DataSource,
  fdv2Endpoints,
  fdv2Poll,
  flagEvalPayloadToItemDescriptors,
  FlagManager,
  internal,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  LDLogger,
  makeFDv2Requestor,
  Platform,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions } from './BrowserIdentifyOptions';

const logTag = '[BrowserFDv2DataManager]';

/**
 * A DataManager that uses the FDv2 protocol for flag delivery.
 *
 * Uses the FDv2DataSource orchestrator with:
 * - Polling initializer (fast one-shot for initial data)
 * - Streaming synchronizer (primary, for live updates)
 * - Polling synchronizer (fallback)
 */
export default class BrowserFDv2DataManager implements DataManager {
  private _dataSource?: FDv2DataSource;
  private _selector?: string;
  private _closed = false;
  private readonly _logger: LDLogger;
  private readonly _statusManager: DataSourceStatusManager;

  constructor(
    private readonly _platform: Platform,
    private readonly _flagManager: FlagManager,
    private readonly _credential: string,
    private readonly _config: Configuration,
    private readonly _baseHeaders: LDHeaders,
    emitter: LDEmitter,
  ) {
    this._logger = _config.logger;
    this._statusManager = createDataSourceStatusManager(emitter);
  }

  async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    if (this._closed) {
      this._logger.debug(`${logTag} Identify called after data manager was closed.`);
      return;
    }

    // Tear down previous data source if any.
    this._dataSource?.close();
    this._dataSource = undefined;
    this._selector = undefined;

    const plainContextString = JSON.stringify(Context.toLDContext(context));
    const endpoints = fdv2Endpoints();

    // Build query params: auth (required for browser — no auth header) and secure mode hash.
    const queryParams: { key: string; value: string }[] = [
      { key: 'auth', value: this._credential },
    ];
    const browserIdentifyOptions = identifyOptions as BrowserIdentifyOptions | undefined;
    if (browserIdentifyOptions?.hash) {
      queryParams.push({ key: 'h', value: browserIdentifyOptions.hash });
    }

    const requestor = makeFDv2Requestor(
      plainContextString,
      this._config.serviceEndpoints,
      endpoints.polling(),
      this._platform.requests,
      this._platform.encoding!,
      this._baseHeaders,
      queryParams,
    );

    const selectorGetter = () => this._selector;

    const dataCallback = (payload: internal.Payload) => {
      this._logger.debug(
        `${logTag} dataCallback: type=${payload.type}, updates=${payload.updates.length}, state=${payload.state}`,
      );

      // Track selector for subsequent basis requests.
      if (payload.state) {
        this._selector = payload.state;
      }

      if (payload.type === 'none') {
        // 304 / no changes — nothing to apply.
        return;
      }

      const descriptors = flagEvalPayloadToItemDescriptors(payload.updates);
      this._logger.debug(`${logTag} descriptors: ${JSON.stringify(Object.keys(descriptors))}`);

      if (payload.type === 'full') {
        this._flagManager.init(context, descriptors);
      } else {
        // 'partial' — incremental updates
        Object.entries(descriptors).forEach(([key, descriptor]) => {
          this._logger.debug(`${logTag} upserting: key=${key}, version=${descriptor.version}`);
          this._flagManager.upsert(context, key, descriptor);
        });
      }
    };

    // Polling initializer — fast one-shot for initial data.
    const pollingInitFactory = (sg: () => string | undefined) =>
      createPollingInitializer(requestor, this._logger, sg);

    // Streaming synchronizer — primary, for live updates.
    const streamingEndpoints = endpoints.streaming();
    const streamingSyncFactory = (_sg: () => string | undefined) => {
      const streamUriPath = streamingEndpoints.pathGet(
        this._platform.encoding!,
        plainContextString,
      );
      const base = createStreamingBase({
        requests: this._platform.requests,
        serviceEndpoints: this._config.serviceEndpoints,
        streamUriPath,
        parameters: queryParams,
        headers: this._baseHeaders,
        initialRetryDelayMillis: this._config.streamInitialReconnectDelay * 1000,
        logger: this._logger,
        pingHandler: {
          handlePing: () => fdv2Poll(requestor, selectorGetter(), false, this._logger),
        },
      });
      return createStreamingSynchronizer(base);
    };

    // Polling synchronizer — fallback if streaming fails.
    const pollingSyncFactory = (sg: () => string | undefined) =>
      createPollingSynchronizer(requestor, this._logger, sg, this._config.pollInterval * 1000);

    this._dataSource = createFDv2DataSource({
      initializerFactories: [pollingInitFactory],
      synchronizerSlots: [
        createSynchronizerSlot(streamingSyncFactory),
        createSynchronizerSlot(pollingSyncFactory),
      ],
      dataCallback,
      statusManager: this._statusManager,
      selectorGetter,
      logger: this._logger,
      // Shorter fallback for easier manual testing (default is 120s).
      fallbackTimeoutMs: 10_000,
    });

    try {
      await this._dataSource.start();
      identifyResolve();
    } catch (err) {
      identifyReject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  close(): void {
    this._closed = true;
    this._dataSource?.close();
    this._dataSource = undefined;
  }
}
