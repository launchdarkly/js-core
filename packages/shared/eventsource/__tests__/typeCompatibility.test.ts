import type {
  EventListener as PlatformEventListener,
  EventSource as PlatformEventSource,
  EventSourceInitDict as PlatformEventSourceInitDict,
} from '@launchdarkly/js-sdk-common';

import { makeEvent, MessageEvent, RetryingEvent } from '../src/Event';
import { createEventSource } from '../src/EventSource';
import { EventSourceInitDict } from '../src/types';
import { deliberatelyUnusedPort } from './helpers';

/**
 * The `EventSource` implementation deliberately does not reference the platform types in its own
 * declarations. `@launchdarkly/js-sdk-common` is a devDependency, so a reference to it in the
 * published declaration files would not resolve for consumers, and under `skipLibCheck` that
 * failure is silent: every inherited member disappears. This test compiles inside the monorepo,
 * where `@launchdarkly/js-sdk-common` resolves, so the assignability check below is the
 * enforcement point for the platform `EventSource` contract. The platform's `EventSourceInitDict`
 * is a separate, deliberately different type -- ours makes every field optional, since consumers
 * build it up incrementally -- so it is not something this package implements; the check below
 * only confirms this package's option type covers every field the platform's init dict declares.
 */

/**
 * This implementation supports every option on the platform init dict, including `urlBuilder`, so
 * the exclusion list is empty. If a future platform option is added to the platform
 * `EventSourceInitDict` without also being added to this package's `EventSourceInitDict`
 * (src/types.ts), the line below fails to compile -- that is the intended signal.
 */
type UnsupportedPlatformOptions = Exclude<
  keyof PlatformEventSourceInitDict,
  keyof EventSourceInitDict
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unsupportedOptionsCheck: UnsupportedPlatformOptions extends never ? true : false = true;

/**
 * `makeEvent`'s overloads: a literal event type resolves to its mapped payload type, a wrong
 * payload key for that literal type fails to compile, and a non-literal string type always
 * resolves to `MessageEvent`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const retryingEventCheck: RetryingEvent = makeEvent('retrying', { delayMillis: 5 });
// @ts-expect-error wrongKey is not a property of RetryingEvent
makeEvent('retrying', { wrongKey: 5 });
const someString: string = 'custom-event';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const messageEventCheck: MessageEvent = makeEvent(someString, {
  data: 'data',
  lastEventId: 'lastEventId',
  origin: 'origin',
});

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
    maxBackoffMillis: 30 * 1000,
    jitterRatio: 0.5,
    withCredentials: false,
  };
  const es: PlatformEventSource = createEventSource(
    `http://localhost:${deliberatelyUnusedPort}`,
    expandedOptions,
  );
  es.onclose = () => {};
  es.onerror = () => {};
  es.onopen = () => {};
  es.onretrying = () => {};
  es.addEventListener('put', () => {});
  es.close();
  // The lines below enforce the typed-listener contract against the package's own types (the
  // `es` above is platform-typed, so it exercises only the platform's signatures).
  const packageTyped = createEventSource(
    `http://localhost:${deliberatelyUnusedPort}`,
    expandedOptions,
  );
  packageTyped.onerror = () => {};
  // A listener written against the platform's EventListener type registers against a literal
  // event name from the event map, and against an arbitrary SSE event name.
  const platformListener: PlatformEventListener = () => {};
  packageTyped.addEventListener('message', platformListener);
  packageTyped.addEventListener('error', platformListener);
  packageTyped.addEventListener('put', platformListener);
  packageTyped.removeEventListener('put', platformListener);
  // The event-map overloads narrow the payload per event type.
  packageTyped.addEventListener('retrying', (event) => {
    const delayMillis: number = event.delayMillis;
    return delayMillis;
  });
  packageTyped.addEventListener('message', (event) => {
    const data: string = event.data;
    return data;
  });
  packageTyped.close();
  // The real assertion is the type-level check above; this just gives jest something to execute.
  expect(es).toBeDefined();
});
