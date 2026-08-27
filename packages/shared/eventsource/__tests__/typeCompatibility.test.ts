import EventSource from '../src/EventSource';
import { EventSourceInitDict } from '../src/types';

/**
 * Mirrors of `packages/shared/common/src/api/platform/EventSource.ts` and the `HttpErrorResponse`
 * it references. These are hand-copied, not imported, so this package stays at zero dependencies.
 * This test verifies internal consistency between this file's mirror and the ported
 * EventSource/EventSourceInitDict -- if the mirror and the port disagree, or if a real
 * platform-interface change isn't reflected here, this comment is the reminder to update the
 * mirror by hand.
 */
interface HttpErrorResponse {
  message: string;
  status?: number;
  headers?: Record<string, string>;
}

type PlatformEventName = string;
type PlatformEventListener = (event?: { data?: any }) => void;

interface PlatformEventSource {
  onclose: (() => void) | undefined;
  onerror: ((err?: HttpErrorResponse) => void) | undefined;
  onopen: ((e: { headers?: { [key: string]: string } }) => void) | undefined;
  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: PlatformEventName, listener: PlatformEventListener): void;
  close(): void;
}

interface PlatformEventSourceInitDict {
  method?: string;
  headers: { [key: string]: string | string[] };
  body?: string;
  errorFilter: (err: HttpErrorResponse) => boolean;
  initialRetryDelayMillis: number;
  readTimeoutMillis: number;
  retryResetIntervalMillis: number;
  urlBuilder?: () => string;
}

/**
 * Platform init-dict options this package does not yet support. `urlBuilder` lets the platform
 * recompute the URL before each reconnect; the ported implementation, like the npm package it was
 * ported from, does not support this yet. This is a real, tracked gap rather than a by-design
 * omission: `StreamingFDv2Base` already relies on `urlBuilder` to refresh its `basis` query param
 * on reconnect, so FDv2 consumers of this package reconnect with a stale URL until it is added. If
 * a future platform option is added here without being added to `EventSourceInitDict`
 * (src/types.ts) or to this allow-list, the line below fails to compile -- that is the intended
 * signal.
 */
type UnsupportedPlatformOptions = Exclude<
  keyof PlatformEventSourceInitDict,
  keyof EventSourceInitDict | 'urlBuilder'
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unsupportedOptionsCheck: UnsupportedPlatformOptions extends never ? true : false = true;

it('satisfies the LaunchDarkly platform EventSource interface', () => {
  const initDict: PlatformEventSourceInitDict = {
    headers: { authorization: 'sdk-key' },
    errorFilter: () => true,
    initialRetryDelayMillis: 1000,
    readTimeoutMillis: 300000,
    retryResetIntervalMillis: 60000,
  };
  // Mirrors what the SDK platform adapters do: spread the platform init dict and add extra
  // implementation-specific options.
  const expandedOptions = {
    ...initDict,
    agent: undefined,
    tlsParams: undefined,
    maxBackoffMillis: 30 * 1000,
    jitterRatio: 0.5,
  };
  const es: PlatformEventSource = new EventSource('http://localhost:44444', expandedOptions);
  es.onclose = () => {};
  es.onerror = () => {};
  es.onopen = () => {};
  es.onretrying = () => {};
  es.addEventListener('put', () => {});
  es.close();
  // The real assertion is the type-level check above; this just gives jest something to execute.
  expect(es).toBeDefined();
});
