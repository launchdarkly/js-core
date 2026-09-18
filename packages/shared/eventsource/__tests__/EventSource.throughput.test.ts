import { createEventSource } from '../src/EventSource';
import { FetchResponse, MessageEvent } from '../src/types';

/**
 * A canned response whose body hands out one prepared chunk and then stays pending forever,
 * like an idle SSE connection. One large chunk is the worst case for the line scan: a fetch
 * transport can deliver thousands of coalesced events in a single read.
 */
function singleChunkResponse(chunk: Uint8Array): FetchResponse {
  let delivered = false;
  return {
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: {
      getReader: () => ({
        read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
          if (!delivered) {
            delivered = true;
            return { done: false, value: chunk };
          }
          return new Promise<never>(() => {});
        },
      }),
    },
  };
}

it('parses many events from one chunk in linear time', async () => {
  // A scan that rescans the buffer per line turns this chunk into minutes of work, so the
  // deadline below fails long before the events arrive. The linear scan needs tens of
  // milliseconds; the deadline leaves a wide margin for slow CI machines.
  const eventCount = 20000;
  let body = '';
  for (let i = 1; i <= eventCount; i += 1) {
    body += `id: ${i}\ndata: {"i":${i},"pad":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}\n\n`;
  }
  const chunk = new TextEncoder().encode(body);

  const received: MessageEvent[] = [];
  const done = new Promise<void>((resolve) => {
    const es = createEventSource('http://localhost/stream', {
      fetch: async () => singleChunkResponse(chunk),
    });
    es.addEventListener('message', (event) => {
      received.push(event);
      if (received.length === eventCount) {
        es.close();
        resolve();
      }
    });
  });

  const started = Date.now();
  await done;
  const elapsedMs = Date.now() - started;

  expect(received).toHaveLength(eventCount);
  expect(received[0].data).toEqual('{"i":1,"pad":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}');
  expect(received[0].lastEventId).toEqual('1');
  expect(received[eventCount - 1].lastEventId).toEqual(String(eventCount));
  expect(elapsedMs).toBeLessThan(5000);
}, 15000);
