import {
  base64UrlEncode,
  Context,
  Encoding,
  internal,
  LDHeaders,
  Platform,
} from '@launchdarkly/js-sdk-common';

import { LDIdentifyOptions } from '../src/api';
import { Configuration } from '../src/configuration/Configuration';
import { BaseDataManager, DataManagerFactory } from '../src/DataManager';
import { DataSourcePaths } from '../src/datasource/DataSourceConfig';
import { makeRequestor } from '../src/datasource/Requestor';
import { FlagManager } from '../src/flag-manager/FlagManager';
import LDEmitter from '../src/LDEmitter';

export default class TestDataManager extends BaseDataManager {
  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    getPollingPaths: () => DataSourcePaths,
    getStreamingPaths: () => DataSourcePaths,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    private readonly _disableNetwork: boolean,
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
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults;

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (loadedFromCache && !waitForNetworkResults) {
      this.logger.debug('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this.logger.debug(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }
    if (this._disableNetwork) {
      identifyResolve();
      return;
    }

    this._setupConnection(context, identifyResolve, identifyReject);
  }

  private _setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;

    this.updateProcessor?.close();

    const requestor = makeRequestor(
      JSON.stringify(Context.toLDContext(context)),
      this.config.serviceEndpoints,
      this.getPollingPaths(),
      this.platform.requests,
      this.platform.encoding!,
      this.baseHeaders,
      [],
      this.config.useReport,
      this.config.withReasons,
    );
    this.createStreamingProcessor(rawContext, context, requestor, identifyResolve, identifyReject);

    this.updateProcessor!.start();
  }
}

export function makeTestDataManagerFactory(
  sdkKey: string,
  platform: Platform,
  options?: {
    disableNetwork?: boolean;
  },
): DataManagerFactory {
  return (
    flagManager: FlagManager,
    configuration: Configuration,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    diagnosticsManager?: internal.DiagnosticsManager,
  ) =>
    new TestDataManager(
      platform,
      flagManager,
      sdkKey,
      configuration,
      () => ({
        pathGet(encoding: Encoding, _plainContextString: string): string {
          return `/msdk/evalx/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return `/msdk/evalx/context`;
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return `/mping`;
        },
      }),
      () => ({
        pathGet(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/path';
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/path/report';
        },
        pathPing(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/path/ping';
        },
      }),
      baseHeaders,
      emitter,
      !!options?.disableNetwork,
      diagnosticsManager,
    );
}
