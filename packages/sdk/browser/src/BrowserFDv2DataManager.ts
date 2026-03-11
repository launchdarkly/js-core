import {
  BROWSER_TRANSITION_TABLE,
  browserFdv1Endpoints,
  Configuration,
  Context,
  createDefaultSourceFactoryProvider,
  createFDv2DataManagerBase,
  DataManager,
  FDv2ConnectionMode,
  FDv2DataManagerControl,
  FlagManager,
  LDEmitter,
  LDHeaders,
  LDIdentifyOptions,
  MODE_TABLE,
  Platform,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserIdentifyOptions } from './BrowserIdentifyOptions';

/**
 * A DataManager that uses the FDv2 protocol for flag delivery with
 * mode switching and debouncing support.
 *
 * Delegates to a shared {@link FDv2DataManagerControl} (from sdk-client)
 * and adds browser-specific behavior:
 * - Auth via query params (no Authorization header in browser)
 * - Listener-driven streaming auto-promotion
 * - Forced streaming via `setStreaming()` API
 */
export default class BrowserFDv2DataManager implements DataManager {
  private readonly _base: FDv2DataManagerControl;

  // If streaming is forced on or off, then we follow that setting.
  // Otherwise we automatically manage streaming state.
  private _forcedStreaming?: boolean = undefined;
  private _automaticStreamingState: boolean = false;

  // +-----------+-----------+------------------+
  // |  forced   | automatic |     state        |
  // +-----------+-----------+------------------+
  // | true      | false     | streaming        |
  // | true      | true      | streaming        |
  // | false     | true      | not streaming    |
  // | false     | false     | not streaming    |
  // | undefined | true      | streaming        |
  // | undefined | false     | configured mode  |
  // +-----------+-----------+------------------+

  constructor(
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    config: Configuration,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
  ) {
    const initialForegroundMode: FDv2ConnectionMode =
      (config.dataSystem?.initialConnectionMode as FDv2ConnectionMode) ?? 'one-shot';

    this._base = createFDv2DataManagerBase({
      platform,
      flagManager,
      credential,
      config,
      baseHeaders,
      emitter,
      transitionTable: BROWSER_TRANSITION_TABLE,
      initialForegroundMode,
      backgroundMode: undefined,
      modeTable: MODE_TABLE,
      sourceFactoryProvider: createDefaultSourceFactoryProvider(),
      fdv1Endpoints: browserFdv1Endpoints(credential),
      buildQueryParams: (identifyOptions?: LDIdentifyOptions) => {
        const params: { key: string; value: string }[] = [{ key: 'auth', value: credential }];
        const browserOpts = identifyOptions as BrowserIdentifyOptions | undefined;
        if (browserOpts?.hash) {
          params.push({ key: 'h', value: browserOpts.hash });
        }
        return params;
      },
    });
  }

  async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    return this._base.identify(identifyResolve, identifyReject, context, identifyOptions);
  }

  close(): void {
    this._base.close();
  }

  setFlushCallback(callback: () => void): void {
    this._base.setFlushCallback(callback);
  }

  setForcedStreaming(streaming?: boolean): void {
    this._forcedStreaming = streaming;
    this._updateStreamingState();
  }

  setAutomaticStreamingState(streaming: boolean): void {
    this._automaticStreamingState = streaming;
    this._updateStreamingState();
  }

  private _updateStreamingState(): void {
    const shouldBeStreaming =
      this._forcedStreaming ||
      (this._automaticStreamingState && this._forcedStreaming === undefined);

    if (shouldBeStreaming) {
      this._base.setForegroundMode('streaming');
    } else {
      this._base.setForegroundMode(this._base.configuredForegroundMode);
    }
  }
}
