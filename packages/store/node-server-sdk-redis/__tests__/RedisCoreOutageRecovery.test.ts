import { Redis } from 'ioredis';
import { AddressInfo, createServer, Server, Socket } from 'net';

import { interfaces } from '@launchdarkly/node-server-sdk';

import RedisClientState from '../src/RedisClientState';
import RedisCore from '../src/RedisCore';
import clearPrefix from './clearPrefix';

const REDIS_PORT = 6379;

/**
 * A TCP proxy in front of the real Redis used by the rest of this suite. Stopping the
 * proxy looks like a Redis outage to the client. Starting it again on the same port
 * looks like a recovery. With `flaky` set, the proxy accepts each TCP connection,
 * holds it briefly with no Redis reply, and then drops it, like a proxy whose
 * upstream is down.
 */
class TcpProxy {
  private _server?: Server;

  private _sockets: Set<Socket> = new Set();

  flaky = false;

  port?: number;

  start(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer((clientSocket) => {
        if (this.flaky) {
          // Hold the accepted connection without a reply before dropping it. This keeps
          // the client in its connecting state long enough that a write issued meanwhile
          // must hit the fail-fast guard. An instant destroy makes that window shorter
          // than one event-loop turn, and a regression would escape the test.
          clientSocket.on('error', () => {});
          clientSocket.on('close', () => this._sockets.delete(clientSocket));
          this._sockets.add(clientSocket);
          setTimeout(() => clientSocket.destroy(), 200).unref();
          return;
        }
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
      // Without this a failed bind hangs the returned promise and skips test cleanup.
      server.once('error', reject);
      server.listen(port ?? 0, '127.0.0.1', () => {
        this.port = (server.address() as AddressInfo).port;
        this._server = server;
        resolve(this.port);
      });
    });
  }

  dropConnections(): void {
    this._sockets.forEach((socket) => socket.destroy());
    this._sockets.clear();
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.dropConnections();
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

function flagData(version: number): interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind> {
  return [
    {
      key: featuresKind,
      item: [
        {
          key: 'flagA',
          item: { version, serializedItem: JSON.stringify({ key: 'flagA', version }) },
        },
      ],
    },
  ];
}

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
    const initError = await initAsync(core, flagData(1));
    expect(initError).toBeUndefined();
    expect(await availableAsync(core)).toBe(true);

    // Outage. The client sees the connection close and keeps reconnecting.
    await proxy.stop();
    await waitFor(() => !state.isConnected(), 5000);

    expect(await availableAsync(core)).toBe(false);
    // The message proves the fail-fast guard answered, not an ioredis retry error.
    const outageUpsert = await upsertAsync(core, 2);
    expect(outageUpsert.err?.message).toEqual('Redis connection is down');
    const outageInit = await initAsync(core, []);
    expect(outageInit?.message).toEqual('Redis connection is down');

    // Recovery on the same port.
    await proxy.start(port);
    await waitFor(() => availableAsync(core), 10000);

    const recoveredUpsert = await upsertAsync(core, 2);
    expect(recoveredUpsert.err).toBeUndefined();
    const recoveredInit = await initAsync(core, flagData(3));
    expect(recoveredInit).toBeUndefined();
    await new Promise<void>((resolve) => {
      core.initialized((isInitialized) => {
        expect(isInitialized).toBe(true);
        resolve();
      });
    });
  } finally {
    core.close();
    // A quit sent while the proxy is down never completes and the client would
    // reconnect forever, which keeps jest alive after a failed run.
    state.getClient().disconnect();
    await proxy.stop();
    await clearPrefix(prefix);
  }
}, 20000);

it('settles every write while the endpoint accepts connections and drops them', async () => {
  const prefix = `outage-flap-${Date.now()}`;
  const proxy = new TcpProxy();
  await proxy.start();

  const state = new RedisClientState({
    redisOpts: { host: '127.0.0.1', port: proxy.port, retryStrategy: () => 100 },
    prefix,
  });
  const core = new RedisCore(state);

  try {
    expect(await initAsync(core, flagData(1))).toBeUndefined();

    // Each reconnect now reaches TCP connect and then drops before the ready check.
    // A write admitted in that window used to lose its callback forever and block
    // the persistent store wrapper's queue.
    proxy.flaky = true;
    proxy.dropConnections();
    await waitFor(() => !state.isConnected(), 5000);

    const pending: Promise<{ err?: Error }>[] = [];
    const end = Date.now() + 1000;
    while (Date.now() < end) {
      pending.push(upsertAsync(core, 2));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    }
    // A lost callback would leave Promise.all pending past the test timeout, which
    // skips the cleanup below and hangs jest. Fail fast with a clear message instead.
    let settleTimer: NodeJS.Timeout | undefined;
    const results = await Promise.race([
      Promise.all(pending),
      new Promise<never>((_, reject) => {
        settleTimer = setTimeout(() => reject(new Error('a write did not settle within 5s')), 5000);
      }),
    ]).finally(() => clearTimeout(settleTimer));
    expect(results.length).toBeGreaterThan(10);
    results.forEach((result) => {
      expect(result.err?.message).toEqual('Redis connection is down');
    });

    proxy.flaky = false;
    await waitFor(() => availableAsync(core), 10000);
    const recovered = await upsertAsync(core, 2);
    expect(recovered.err).toBeUndefined();
  } finally {
    core.close();
    // A quit sent while the proxy is flaky or down never completes and the client
    // would reconnect forever, which keeps jest alive after a failed run.
    state.getClient().disconnect();
    await proxy.stop();
    await clearPrefix(prefix);
  }
}, 20000);

it('does not leave a watch armed after a not-updated write', async () => {
  const prefix = `outage-watch-${Date.now()}`;
  const state = new RedisClientState({
    redisOpts: { host: '127.0.0.1', port: REDIS_PORT },
    prefix,
  });
  const core = new RedisCore(state);
  const foreignClient = new Redis();

  try {
    expect(await initAsync(core, flagData(5))).toBeUndefined();

    const notUpdated = await upsertAsync(core, 3);
    expect(notUpdated.err).toBeUndefined();
    expect(notUpdated.updated?.version).toEqual(5);

    // A foreign write to the watched hash. A watch left armed on the store's
    // connection would silently abort the next transaction on it.
    await foreignClient.hset(
      `${prefix}:features`,
      'flagB',
      JSON.stringify({ key: 'flagB', version: 1 }),
    );

    expect(await initAsync(core, flagData(6))).toBeUndefined();
    expect(await foreignClient.exists(`${prefix}:$inited`)).toEqual(1);
    expect(await foreignClient.hget(`${prefix}:features`, 'flagA')).toEqual(
      JSON.stringify({ key: 'flagA', version: 6 }),
    );
  } finally {
    core.close();
    await foreignClient.quit();
    await clearPrefix(prefix);
  }
}, 20000);

it('settles a write issued during a flaky initial connection', async () => {
  const prefix = `outage-startup-${Date.now()}`;
  const proxy = new TcpProxy();
  // Flaky before the first connect: every early connection reaches TCP connect and is
  // dropped before any Redis reply. The initial-connection exemption admits writes in
  // that window, so the transport must queue them instead of losing them.
  proxy.flaky = true;
  await proxy.start();

  const state = new RedisClientState({
    redisOpts: { host: '127.0.0.1', port: proxy.port, retryStrategy: () => 100 },
    prefix,
  });
  const core = new RedisCore(state);
  const foreignClient = new Redis();

  try {
    // Issue the write inside the first TCP-connect window. A bare watch written to
    // that socket used to be discarded without a rejection, and the callback then
    // never settled, which blocked the wrapper queue until process restart.
    const pending = new Promise<{ err?: Error; updated?: interfaces.SerializedItemDescriptor }>(
      (resolve) => {
        state.getClient().once('connect', () => {
          upsertAsync(core, 1).then(resolve);
        });
      },
    );
    setTimeout(() => {
      proxy.flaky = false;
    }, 300).unref();

    let settleTimer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        settleTimer = setTimeout(
          () => reject(new Error('the startup write did not settle within 5s')),
          5000,
        );
      }),
    ]).finally(() => clearTimeout(settleTimer));

    expect(result.err).toBeUndefined();
    expect(await foreignClient.hget(`${prefix}:features`, 'flagA')).toEqual(
      JSON.stringify({ key: 'flagA', version: 1 }),
    );
  } finally {
    core.close();
    state.getClient().disconnect();
    await proxy.stop();
    await foreignClient.quit();
    await clearPrefix(prefix);
  }
}, 20000);
