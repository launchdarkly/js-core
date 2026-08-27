import * as http from 'http';

import {
  shouldReceiveMessages,
  startErrorQueue,
  withEventSource,
  withProxy,
  withSecureProxy,
  withServer,
  writeEvents,
} from './helpers';

it('proxies http to http requests', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: World\n\n']));
    await withProxy(async (proxy) => {
      await withEventSource(server.url, { proxy: proxy.url }, async (es) => {
        await shouldReceiveMessages(es, [{ data: 'World' }]);
        expect(proxy.requestCount()).toBeGreaterThan(0);
      });
    });
  });
});

it('proxies https to http requests', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: World\n\n']));
    await withSecureProxy(async (proxy) => {
      await withEventSource(
        server.url,
        // rejectUnauthorized: false is redundant with EventSource.ts's own default of false;
        // kept to document that the proxy's self-signed certificate must be accepted.
        { proxy: proxy.url, rejectUnauthorized: false },
        async (es) => {
          await shouldReceiveMessages(es, [{ data: 'World' }]);
          expect(proxy.requestCount()).toBeGreaterThan(0);
        },
      );
    });
  });
});

// This stands in for the dropped tunneling-agent test: passing a caller-supplied http.Agent is
// the same code path EventSource.ts uses to proxy via http.Agent-based tunneling.
it('uses a caller-supplied agent for the connection', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: World\n\n']));
    const agent = new http.Agent({ keepAlive: false });
    const createConnection = jest.spyOn(agent, 'createConnection');
    try {
      await withEventSource(server.url, { agent }, async (es) => {
        const errors = startErrorQueue(es);
        await shouldReceiveMessages(es, [{ data: 'World' }]);
        expect(createConnection).toHaveBeenCalled();
        expect(createConnection.mock.calls[0][0].port).toEqual(server.port);
        expect(errors.isEmpty()).toBe(true);
      });
    } finally {
      agent.destroy();
    }
  });
});
