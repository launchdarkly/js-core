import { EventSourceInitDict } from '@launchdarkly/js-server-sdk-common';

import EdgeRequests from '../../src/platform/requests';

const TEXT_RESPONSE = '';
const JSON_RESPONSE = {};

describe('given a default instance of requests', () => {
  const requests = new EdgeRequests();

  describe('fetch', () => {
    it('Basic request always returns empty text', async () => {
      const res = await requests.fetch(`http://localhost`);
      expect(res.headers).toEqual({});
      expect(res.status).toEqual(0);
      const text = await res.text();
      expect(text).toEqual(TEXT_RESPONSE);
    });

    it('Basic request always returns empty json', async () => {
      const res = await requests.fetch(`http://localhost`);
      expect(res.headers).toEqual({});
      expect(res.status).toEqual(0);
      const json = await res.json();
      expect(json).toEqual(JSON_RESPONSE);
    });
  });

  describe('create event source', () => {
    it('event source should have undefined methods', async () => {
      const eventsource = requests.createEventSource(`http://localhost`, {} as EventSourceInitDict);
      expect(eventsource.onclose).toBeUndefined();
      expect(eventsource.onerror).toBeUndefined();
      expect(eventsource.onopen).toBeUndefined();
      expect(eventsource.onretrying).toBeUndefined();
    });
  });
});
