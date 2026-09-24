// Proof test for the scrutinize finding "backoff-anchor-missing".
// See .claude/scrutinize/artifacts/scrutinize-js-core-2030-round2.md (repo root).
//
// The retry backoff reset must be anchored to the first event of each connection. This
// client re-anchors on every event, so a connection that delivers events continuously
// past retryResetIntervalMillis never resets the backoff. This test fails while the bug
// is present and passes when the anchor fix is ported.

// eslint-disable-next-line import/no-extraneous-dependencies
import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { EventSourceInitDict } from '../src/types';
import { withEventSource, withServer } from './helpers';

it('resets backoff after a connection stays active past the reset interval', async () => {
  const delay = 5;
  const resetInterval = 150;

  // The first two connections fail immediately, so the backoff progresses. The third
  // connection delivers events continuously for longer than the reset interval and then
  // drops. The delay after it must restart at the initial value, even though the last
  // event arrived only moments before the drop.
  let connection = 0;
  const handler = (_req: any, res: any) => {
    connection += 1;
    if (connection === 3) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: one\n\n');
      let writes = 0;
      const timer = setInterval(() => {
        writes += 1;
        if (writes > 6) {
          clearInterval(timer);
          res.destroy();
        } else {
          res.write('data: more\n\n');
        }
      }, 40);
    } else {
      res.writeHead(500);
      res.end();
    }
  };

  const options: Partial<EventSourceInitDict> = {
    initialRetryDelayMillis: delay,
    maxBackoffMillis: 1000,
    retryResetIntervalMillis: resetInterval,
  };

  await withServer(async (server) => {
    server.byDefault(handler);
    await withEventSource(server.url, options, async (es) => {
      const delays = new AsyncQueue<number>();
      es.onretrying = (event) => delays.add(event.delayMillis);
      const allDelays: number[] = [];
      while (allDelays.length < 3) {
        // eslint-disable-next-line no-await-in-loop
        allDelays.push(await delays.take());
      }
      expect(allDelays).toEqual([delay, delay * 2, delay]);
    });
  });
});
