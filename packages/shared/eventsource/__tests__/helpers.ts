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

import { createEventSource, EventSource } from '../src/EventSource';
import { ErrorEvent, EventSourceInitDict, MessageEvent, OpenEvent } from '../src/types';

// A fixed port that no test in this suite ever binds a server to.
export const deliberatelyUnusedPort = 44446;

// Distinct from deliberatelyUnusedPort: this one is expected to have a server bound to it
// transiently, by the one test that exercises reconnection into a server that starts late.
export const initiallyDownServerPort = 44447;

/**
 * Waits for `server` to be completely shut down -- every connection ended, not just the listening
 * socket unbound. Tolerates a server an `action` already closed itself (e.g. via its own
 * `closeAndWait()` call), since closing an already-closed `http.Server` rejects with
 * `ERR_SERVER_NOT_RUNNING` rather than resolving.
 *
 * `TestHttpServer.close()` (what the library's own `withCloseable` would call instead of this) kicks
 * off that shutdown but does not wait for it, so control could otherwise return to the *next* test,
 * or the next test *file*, while this server's port is still bound and a client of this test's
 * `EventSource` could still be retrying against it. Each test file gets its own module registry, so
 * the dynamic port counter this library uses restarts from the same value in every file: without
 * waiting here, a later file's server can end up reusing this exact port number while this one is
 * still live, and a leftover retrying connection from this test can cross into that later file's
 * server.
 */
async function closeAndWaitIdempotent(server: TestHttpServer): Promise<void> {
  try {
    await server.closeAndWait();
  } catch (err) {
    if ((err as { code?: string })?.code !== 'ERR_SERVER_NOT_RUNNING') {
      throw err;
    }
  }
}

export async function withServer(action: (server: TestHttpServer) => Promise<void>): Promise<void> {
  const server = await TestHttpServers.start();
  try {
    await action(server);
  } finally {
    await closeAndWaitIdempotent(server);
  }
}

export async function withServerOnPort(
  port: number,
  action: (server: TestHttpServer) => Promise<void>,
): Promise<void> {
  const server = await TestHttpServers.start({}, port);
  try {
    await action(server);
  } finally {
    await closeAndWaitIdempotent(server);
  }
}

export async function withEventSource(
  url: string,
  opts: Partial<EventSourceInitDict> | undefined,
  action: (es: EventSource) => Promise<void>,
): Promise<void> {
  const es = createEventSource(url, opts);
  // Absorbs the error a test is not interested in, which most of these tests get while the server
  // is being torn down. A test that does care replaces this by assigning `onerror` again.
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

/**
 * Collects both `error` and `end` events.
 *
 * A stream the server ends cleanly is reported as `end`, not `error` -- with a fetch transport a
 * server shutdown surfaces as a clean end-of-stream far more often than it does with a raw socket,
 * so tests that only care that the connection dropped have to listen for both.
 */
export function startErrorOrEndQueue(es: EventSource): AsyncQueue<ErrorEvent | undefined> {
  const events = new AsyncQueue<ErrorEvent | undefined>();
  es.onerror = (e) => events.add(e);
  es.addEventListener('end', (e) => events.add(e));
  return events;
}

export function startMessageQueue(es: EventSource): AsyncQueue<MessageEvent> {
  const messages = new AsyncQueue<MessageEvent>();
  es.addEventListener('message', (m) => messages.add(m));
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
