import type {
  EventSource as PlatformEventSource,
  EventSourceInitDict as PlatformEventSourceInitDict,
} from '@launchdarkly/js-sdk-common';

import { EventSource } from '../src/EventSource';
import { SupportedOptionName } from '../src/types';

/**
 * The package's types now derive from the platform types in `@launchdarkly/js-sdk-common`
 * (a regular dependency), so basic assignability is enforced by the compiler at the declaration
 * sites in `src/types.ts` and `src/EventSource.ts`. This file keeps two remaining signals:
 *
 * 1. The allow-list check below. Because `EventSourceInitDict` inherits the platform init dict,
 *    a NEW platform option flows into this package's option type automatically -- meaning the
 *    type would claim support the implementation may not have. The check compares the platform's
 *    option names against this package's own `SupportedOptionName` list plus a small allow-list,
 *    so adding a platform option fails compilation here until someone makes a conscious decision:
 *    implement it (and extend `SupportedOptionName`), or record it as unsupported.
 * 2. A runtime smoke test mirroring how the SDK platform adapters construct the EventSource.
 */

/**
 * Platform options that are real, supported options but are deliberately absent from the runtime
 * `EventSource.supportedOptions` feature-detection list (`body`, `readTimeoutMillis`), plus the
 * one platform option this package does not support at all: `urlBuilder`, which lets the platform
 * recompute the URL before each reconnect. That one is a real, tracked gap rather than a
 * by-design omission: `StreamingFDv2Base` already relies on `urlBuilder` to refresh its `basis`
 * query param on reconnect, so FDv2 consumers of this package reconnect with a stale URL until it
 * is added.
 */
type AllowListedPlatformOptions = 'body' | 'readTimeoutMillis' | 'urlBuilder';
type UnaccountedPlatformOptions = Exclude<
  keyof PlatformEventSourceInitDict,
  SupportedOptionName | AllowListedPlatformOptions
>;
// oxlint-disable-next-line no-unused-vars
const unaccountedOptionsCheck: UnaccountedPlatformOptions extends never ? true : false = true;

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
    https: undefined,
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
