import { AddressInfo, createServer, Server, Socket } from 'net';

import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisClientState from '../src/RedisClientState';
import RedisCore from '../src/RedisCore';
import clearPrefix from './clearPrefix';

const REDIS_PORT = 6379;

/**
 * A TCP proxy in front of the real Redis used by the rest of this suite. Stopping the
 * proxy looks like a Redis outage to the client. Starting it again on the same port
 * looks like a recovery.
 */
class TcpProxy {
  private _server?: Server;

  private _sockets: Set<Socket> = new Set();

  port?: number;

  start(port?: number): Promise<number> {
    return new Promise((resolve) => {
      const server = createServer((clientSocket) => {
        const upstream = new Socket();
        upstream.connect(REDIS_PORT, '127.0.0.1');
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
        clientSocket.on('error', () => {});
        upstream.on('error', () => {});
        clientSocket.on('close', () => upstream.destroy());
        upstream.on('close', () => clientSocket.destroy());
        this._sockets.add(clientSocket);
        this._sockets.add(upstream);
      });
      server.listen(port ?? 0, '127.0.0.1', () => {
        this.port = (server.address() as AddressInfo).port;
        this._server = server;
        resolve(this.port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this._sockets.forEach((socket) => socket.destroy());
      this._sockets.clear();
      const server = this._server;
      this._server = undefined;
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

const featuresKind = { namespace: 'features', deserialize: (data: string) => JSON.parse(data) };

function initAsync(
  core: RedisCore,
  allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    core.init(allData, resolve);
  });
}

function upsertAsync(
  core: RedisCore,
  version: number,
): Promise<{ err?: Error; updated?: interfaces.SerializedItemDescriptor }> {
  return new Promise((resolve) => {
    core.upsert(
      featuresKind,
      'flagA',
      { version, serializedItem: JSON.stringify({ key: 'flagA', version }) },
      (err, updated) => resolve({ err, updated }),
    );
  });
}

function availableAsync(core: RedisCore): Promise<boolean> {
  return new Promise((resolve) => {
    core.isStoreAvailable(resolve);
  });
}

async function waitFor(condition: () => Promise<boolean> | boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error('Timed out waiting for condition');
}

it('reports errors during an outage and recovers when the connection returns', async () => {
  const prefix = `outage-test-${Date.now()}`;
  const proxy = new TcpProxy();
  const port = await proxy.start();

  const state = new RedisClientState({
    redisOpts: { host: '127.0.0.1', port, retryStrategy: () => 100 },
    prefix,
  });
  const core = new RedisCore(state);

  try {
    const initError = await initAsync(core, [
      {
        key: featuresKind,
        item: [
          {
            key: 'flagA',
            item: { version: 1, serializedItem: JSON.stringify({ key: 'flagA', version: 1 }) },
          },
        ],
      },
    ]);
    expect(initError).toBeUndefined();
    expect(await availableAsync(core)).toBe(true);

    // Outage. The client sees the connection close and keeps reconnecting.
    await proxy.stop();
    await waitFor(() => !state.isConnected(), 5000);

    expect(await availableAsync(core)).toBe(false);
    const outageUpsert = await upsertAsync(core, 2);
    expect(outageUpsert.err).toBeDefined();
    const outageInit = await initAsync(core, []);
    expect(outageInit).toBeDefined();

    // Recovery on the same port.
    await proxy.start(port);
    await waitFor(() => availableAsync(core), 10000);

    const recoveredUpsert = await upsertAsync(core, 2);
    expect(recoveredUpsert.err).toBeUndefined();
    const recoveredInit = await initAsync(core, [
      {
        key: featuresKind,
        item: [
          {
            key: 'flagA',
            item: { version: 3, serializedItem: JSON.stringify({ key: 'flagA', version: 3 }) },
          },
        ],
      },
    ]);
    expect(recoveredInit).toBeUndefined();
    await new Promise<void>((resolve) => {
      core.initialized((isInitialized) => {
        expect(isInitialized).toBe(true);
        resolve();
      });
    });
  } finally {
    core.close();
    await proxy.stop();
    await clearPrefix(prefix);
  }
}, 20000);
