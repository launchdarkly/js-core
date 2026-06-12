import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import { createClient } from '../src';
import NodeDataManager from '../src/NodeDataManager';
import { NodeClient } from '../src/NodeClient';
import { makeMockPlatform, mockFetch } from './NodeClient.mocks';

// Replace NodePlatform's constructor with one that returns the mock platform. Lets us
// inject deterministic fetch / EventSource without touching the real filesystem or network.
jest.mock('../src/platform/NodePlatform', () => {
  const { makeMockPlatform: makePlatform } = jest.requireActual('./NodeClient.mocks');
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => makePlatform()),
  };
});

const NodePlatformMock = jest.requireMock('../src/platform/NodePlatform').default as jest.Mock;

const bootstrapData = {
  'string-flag': 'is bob',
  'my-boolean-flag': false,
  $flagsState: {
    'string-flag': { variation: 1, version: 3 },
    'my-boolean-flag': { variation: 1, version: 11 },
  },
  $valid: true,
};

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  NodePlatformMock.mockReset();
  NodePlatformMock.mockImplementation(() => makeMockPlatform());
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('start with streaming + bootstrap resolves and opens streaming connection', async () => {
  const fakePlatform = makeMockPlatform();
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  const result = await client.start({ bootstrap: bootstrapData });

  expect(result.status).toBe('complete');
  expect(client.stringVariation('string-flag', 'default')).toBe('is bob');
  expect(client.boolVariation('my-boolean-flag', true)).toBe(false);
  // Streaming connection was opened for ongoing updates (the fix lets streaming start
  // alongside bootstrap; the previous bug just routed identify callbacks through it).
  expect(fakePlatform.requests.createEventSource).toHaveBeenCalled();

  await client.close();
});

it('bootstrap in streaming mode invokes _setupConnection without identify callbacks (regression guard)', async () => {
  const setupSpy = jest.spyOn(NodeDataManager.prototype as any, '_setupConnection');
  const fakePlatform = makeMockPlatform();
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  // The fix: streaming setup happens without forwarding identify callbacks, since
  // bootstrap already resolved identify.
  expect(setupSpy).toHaveBeenCalled();
  const lastCallArgs = setupSpy.mock.calls[setupSpy.mock.calls.length - 1];
  expect(lastCallArgs[1]).toBeUndefined();
  expect(lastCallArgs[2]).toBeUndefined();

  await client.close();
});

it('polling mode without bootstrap uses identify callbacks on _setupConnection', async () => {
  const setupSpy = jest.spyOn(NodeDataManager.prototype as any, '_setupConnection');
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: mockFetch(JSON.stringify(bootstrapData), 200),
      createEventSource: jest.fn(),
      getEventSourceCapabilities: () => ({ readTimeout: false, headers: true, customMethod: false }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'polling',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ timeout: 2 });

  // Without bootstrap, identify is resolved via the network processor -- callbacks
  // must be forwarded to _setupConnection.
  expect(setupSpy).toHaveBeenCalled();
  const firstCallArgs = setupSpy.mock.calls[0];
  expect(typeof firstCallArgs[1]).toBe('function');
  expect(typeof firstCallArgs[2]).toBe('function');

  await client.close();
});

it('polling mode opens a fetch request to the polling endpoint', async () => {
  const fetchMock = mockFetch(JSON.stringify(bootstrapData), 200);
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: fetchMock,
      createEventSource: jest.fn(),
      getEventSourceCapabilities: () => ({ readTimeout: false, headers: true, customMethod: false }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'polling',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ timeout: 2 });

  const pollingCall = fetchMock.mock.calls.find(([url]: [string]) => url.includes('/sdk/evalx/'));
  expect(pollingCall).toBeDefined();

  await client.close();
});

it('streaming mode opens an EventSource to the streaming endpoint with authorization header', async () => {
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: false, headers: true, customMethod: false }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  expect(createEventSource).toHaveBeenCalled();
  const firstCall = (createEventSource.mock.calls as unknown as [string, any][])[0];
  expect(firstCall[0]).toMatch(/\/eval\//);
  expect(firstCall[1].headers).toMatchObject({ authorization: 'client-side-id' });

  await client.close();
});

it('setConnectionMode offline -> streaming brings the data source back up', async () => {
  const fakePlatform = makeMockPlatform();
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'offline',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  expect(client.isOffline()).toBe(true);
  expect(fakePlatform.requests.createEventSource).not.toHaveBeenCalled();

  await client.setConnectionMode('streaming');
  expect(client.isOffline()).toBe(false);
  expect(client.getConnectionMode()).toBe('streaming');
  expect(fakePlatform.requests.createEventSource).toHaveBeenCalled();

  await client.close();
});

it('streaming with useReport opens an EventSource using REPORT to the no-context path', async () => {
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      useReport: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  expect(createEventSource).toHaveBeenCalled();
  const firstCall = (createEventSource.mock.calls as unknown as [string, any][])[0];
  // REPORT mode hits /eval/<env> without an encoded context segment in the path.
  expect(firstCall[0]).toMatch(/\/eval\/client-side-id(?:\?|$)/);

  await client.close();
});

it('setConnectionMode streaming -> offline tears down the EventSource', async () => {
  const eventSourceClose = jest.fn();
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: eventSourceClose,
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: false, headers: true, customMethod: false }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  expect(createEventSource).toHaveBeenCalledTimes(1);

  await client.setConnectionMode('offline');
  expect(client.isOffline()).toBe(true);
  expect(eventSourceClose).toHaveBeenCalled();

  await client.close();
});

it('keeps event-sending state consistent with the mode under concurrent setConnectionMode', async () => {
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: mockFetch('', 202),
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  // Use the implementation directly so we can assert on the internal event-sending flag,
  // which governs background (timer-driven) analytics delivery.
  const client = new NodeClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: true,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  // Fire two transitions without awaiting between them. Without serialization the offline
  // transition could settle while event-sending is left enabled.
  const p1 = client.setConnectionMode('streaming');
  const p2 = client.setConnectionMode('offline');
  await Promise.all([p1, p2]);

  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);
  // When offline, background analytics delivery must be disabled.
  // eslint-disable-next-line no-underscore-dangle
  expect((client as any)._eventSendingEnabled).toBe(false);

  await client.close();
});

it('rejects identify called after close without waiting for the identify timeout', async () => {
  const fakePlatform = makeMockPlatform();
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });
  await client.close();

  const start = Date.now();
  const result = await client.identify({ kind: 'user', key: 'alice' });
  const elapsed = Date.now() - start;

  expect(result.status).toBe('error');
  // Should fail fast, not sit until the 5s identify timeout.
  expect(elapsed).toBeLessThan(1000);
});

it('does not read cached flags when bootstrap is provided', async () => {
  const fakePlatform = makeMockPlatform();
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  // Bootstrap and cache are mutually exclusive: cached flags must not be consulted (and so
  // cannot overwrite) the freshly applied bootstrap data.
  expect(fakePlatform.storage!.get).not.toHaveBeenCalled();

  await client.close();
});

it('rejects an in-flight identify immediately when close() is called while the processor awaits its first event', async () => {
  // The streaming processor never fires a 'put' event, simulating a slow or stalled stream.
  // close() must reject _pendingIdentifyReject promptly so the caller is not left waiting for
  // the 5-second identify timeout.
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  // Identify without bootstrap: cache miss -> _setupConnection -> processor running, no 'put' yet.
  const identifyPromise = client.identify({ kind: 'user', key: 'alice' }, { timeout: 5 });
  // Allow the identify to reach the streaming processor before closing.
  await new Promise((resolve) => setTimeout(resolve, 10));

  await client.close();

  const result = await identifyPromise;
  expect(result.status).toBe('error');
});

it('rejects an in-flight identify when setConnectionMode offline runs after the processor started', async () => {
  // The processor phase: identify has passed loadCached and _setupConnection has registered
  // _pendingIdentifyReject. The stream never delivers a 'put', so the only way out is the
  // reject path.
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  const identifyPromise = client.identify({ kind: 'user', key: 'alice' }, { timeout: 5 });
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Go offline while the streaming processor is running and waiting for its first event.
  await client.setConnectionMode('offline');

  const result = await identifyPromise;
  expect(result.status).toBe('error');

  await client.close();
});

it('rejects an in-flight identify when setConnectionMode switches modes while the processor is running', async () => {
  // Switching from streaming to polling replaces the active processor. The pending identify
  // on the old processor must be rejected rather than silently abandoned.
  const createEventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: createEventSource as any,
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  await client.start({ bootstrap: bootstrapData });

  const identifyPromise = client.identify({ kind: 'user', key: 'alice' }, { timeout: 5 });
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Switch to polling -- the old streaming processor is replaced; the pending identify rejects.
  await client.setConnectionMode('polling');

  const result = await identifyPromise;
  expect(result.status).toBe('error');

  await client.close();
});

it('rejects identify fast when close() runs while loadCached is in flight', async () => {
  // Gate the cached-flag read so we can close the client while identify is parked on
  // the await - reproducing the race where the post-await path would otherwise resolve
  // or start a processor on a closed client.
  let releaseGet: () => void = () => {};
  const getGate = new Promise<void>((resolve) => {
    releaseGet = resolve;
  });

  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  (fakePlatform as any).storage = {
    get: jest.fn(async () => {
      await getGate;
      return null;
    }),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  // Bootstrap on start so the first identify skips the (gated) cache read.
  await client.start({ bootstrap: bootstrapData });

  const start = Date.now();
  // A second identify without bootstrap parks on the gated storage.get.
  const identifyPromise = client.identify({ kind: 'user', key: 'alice' }, { timeout: 5 });
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Close the client while identify is parked, then release the cache read.
  await client.close();
  releaseGet();

  const result = await identifyPromise;
  const elapsed = Date.now() - start;
  expect(result.status).toBe('error');
  // Should fail fast -- the post-await closed-check rejects rather than waiting on the timeout.
  expect(elapsed).toBeLessThan(1000);
});

it('rejects identify when waitForNetworkResults was requested and mode flips to offline mid-identify with a cache hit', async () => {
  let releaseGet: () => void = () => {};
  const getGate = new Promise<void>((resolve) => {
    releaseGet = resolve;
  });

  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  // Storage returns a non-null value so loadCached produces a cache hit.
  (fakePlatform as any).storage = {
    get: jest.fn(async () => {
      await getGate;
      // Return a minimal serialised flags object so the cache hit path is taken.
      return JSON.stringify({ flagA: { flag: { variation: 0, version: 1 } } });
    }),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  // Bootstrap on start so the first identify skips the (gated) cache read.
  await client.start({ bootstrap: bootstrapData });

  // Identify with waitForNetworkResults so the caller explicitly does NOT want to settle
  // early from cache. The identify parks on the gated storage.get.
  const identifyPromise = client.identify(
    { kind: 'user', key: 'alice' },
    { waitForNetworkResults: true, timeout: 2 },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Flip to offline while identify is parked, then release the cache read.
  await client.setConnectionMode('offline');
  releaseGet();

  const result = await identifyPromise;
  // The identify must reject -- the mode-change-to-offline makes it impossible to honour
  // waitForNetworkResults, and silently settling from cache would mask that.
  expect(result.status).toBe('error');

  await client.close();
});

it('rejects identify rather than hanging when the mode flips to offline mid-identify', async () => {
  // Gate the cached-flag read so we can flip the connection mode while identify is parked on
  // the await -- reproducing the race where _setupConnection later sees connectionMode==='offline'.
  let releaseGet: () => void = () => {};
  const getGate = new Promise<void>((resolve) => {
    releaseGet = resolve;
  });

  const fakePlatform = makeMockPlatform({
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        onopen: jest.fn(),
        onretrying: jest.fn(),
      })),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
  });
  (fakePlatform as any).storage = {
    get: jest.fn(async () => {
      await getGate;
      return null;
    }),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  NodePlatformMock.mockImplementationOnce(() => fakePlatform);

  const client = createClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      initialConnectionMode: 'streaming',
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
    },
  );

  // Bootstrap on start so the first identify skips the (gated) cache read.
  await client.start({ bootstrap: bootstrapData });

  // A second identify without bootstrap routes through the cache path and parks on the gated get.
  const identifyPromise = client.identify({ kind: 'user', key: 'alice' }, { timeout: 2 });
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Flip to offline while identify is parked, then release the cache read.
  await client.setConnectionMode('offline');
  releaseGet();

  const result = await identifyPromise;
  // With the fix the identify settles immediately as an error; the bug would hang to timeout.
  expect(result.status).toBe('error');

  await client.close();
});
