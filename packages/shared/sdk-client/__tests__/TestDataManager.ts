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
import { FlagManager } from '../src/flag-manager/FlagManager';
import LDEmitter from '../src/LDEmitter';

export default class TestDataManager extends BaseDataManager {
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

    this.setupConnection(context, identifyResolve, identifyReject);
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
}

export function makeTestDataManagerFactory(sdkKey: string, platform: Platform): DataManagerFactory {
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
      }),
      () => ({
        pathGet(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/path';
        },
        pathReport(_encoding: Encoding, _plainContextString: string): string {
          return '/stream/path/report';
        },
      }),
      baseHeaders,
      emitter,
      diagnosticsManager,
    );
}
