// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AsyncQueue,
  sleepAsync,
  TestHttpHandlers,
  TestHttpHeaders,
  TestHttpServer,
  TestHttpServers,
  withCloseable,
} from 'launchdarkly-js-test-helpers';

import EventSource from '../src/EventSource';
import { ErrorEvent, EventSourceInitDict, MessageEvent, OpenEvent } from '../src/types';

export const deliberatelyUnusedPort = 44444;

// Distinct from deliberatelyUnusedPort: this one is expected to have a server bound to it
// transiently, by the one test that exercises reconnection into a server that starts late.
// Keeping it separate means deliberatelyUnusedPort's "nothing is ever listening here" assumption,
// relied on by other test files, stays true for the whole suite.
export const initiallyDownServerPort = 44445;

export async function withServer(
  action: (server: TestHttpServer) => Promise<void>,
): Promise<void> {
  await withCloseable(TestHttpServers.start, action);
}

export async function withSecureServer(
  action: (server: TestHttpServer) => Promise<void>,
): Promise<void> {
  await withCloseable(TestHttpServers.startSecure, action);
}

export async function withServerOnPort(
  port: number,
  action: (server: TestHttpServer) => Promise<void>,
): Promise<void> {
  await withCloseable(() => TestHttpServers.start({}, port), action);
}

export async function withProxy(
  action: (proxy: TestHttpServer) => Promise<void>,
): Promise<void> {
  await withCloseable(TestHttpServers.startProxy, action);
}

export async function withSecureProxy(
  action: (proxy: TestHttpServer) => Promise<void>,
): Promise<void> {
  await withCloseable(TestHttpServers.startSecureProxy, action);
}

export async function withEventSource(
  url: string,
  opts: EventSourceInitDict | undefined,
  action: (es: EventSource) => Promise<void>,
): Promise<void> {
  const es = new EventSource(url, opts);
  // Set a default error handler to avoid unhandled errors, since in most of these tests the
  // EventSource is likely to get an error we don't care about while the test is being torn down.
  es.onerror = () => {};
  await withCloseable(es, action);
}

export async function waitForOpenEvent(es: EventSource): Promise<OpenEvent> {
  const opened = new AsyncQueue<OpenEvent>();
  es.onopen = (e) => opened.add(e);
  return opened.take();
}

export function startErrorQueue(es: EventSource): AsyncQueue<ErrorEvent> {
  const errors = new AsyncQueue<ErrorEvent>();
  es.onerror = (e) => errors.add(e as ErrorEvent);
  return errors;
}

export function startMessageQueue(es: EventSource): AsyncQueue<MessageEvent> {
  const messages = new AsyncQueue<MessageEvent>();
  es.onmessage = (m) => messages.add(m);
  return messages;
}

export async function shouldReceiveMessages(
  es: EventSource,
  expected: { data: string; type?: string }[],
): Promise<void> {
  const queue = startMessageQueue(es);
  for (const e of expected) {
    // eslint-disable-next-line no-await-in-loop
    const actual = await queue.take();
    expect(actual.data).toEqual(e.data);
    expect(actual.type).toEqual(e.type ?? 'message');
  }
}

export async function expectNothingReceived(q: AsyncQueue<any>): Promise<void> {
  await sleepAsync(100);
  expect(q.isEmpty()).toBe(true);
}

export function writeEvents(chunks: string[], headers: TestHttpHeaders = {}) {
  const resHeaders = { ...headers, 'Content-Type': 'text/event-stream' };
  const q = new AsyncQueue<string>();
  chunks.forEach((chunk) => q.add(chunk));
  return TestHttpHandlers.chunkedStream(200, resHeaders, q);
}

export function expectInRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}
