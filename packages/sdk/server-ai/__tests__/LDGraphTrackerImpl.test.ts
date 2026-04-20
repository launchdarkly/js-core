import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDClientMin } from '../src/LDClientMin';
import { LDGraphTrackerImpl } from '../src/LDGraphTrackerImpl';

const mockTrack = jest.fn();
const mockWarn = jest.fn();
const mockLdClient: LDClientMin = {
  track: mockTrack,
  variation: jest.fn(),
  logger: { warn: mockWarn, error: jest.fn(), info: jest.fn(), debug: jest.fn() },
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };
const graphKey = 'my-agent-graph';
const variationKey = 'v1';
const version = 2;

const makeTracker = (runId = 'test-run-id') =>
  new LDGraphTrackerImpl(mockLdClient, runId, graphKey, variationKey, version, testContext);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getTrackData
// ---------------------------------------------------------------------------

it('returns correct track data with variationKey', () => {
  const tracker = makeTracker('fixed-run-id');
  expect(tracker.getTrackData()).toEqual({
    runId: 'fixed-run-id',
    graphKey,
    version,
    variationKey,
  });
});

it('omits variationKey when not provided', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    'some-run-id',
    graphKey,
    undefined,
    version,
    testContext,
  );
  const data = tracker.getTrackData();
  expect(data.variationKey).toBeUndefined();
  expect(data.graphKey).toBe(graphKey);
  expect(data.version).toBe(version);
  expect(data.runId).toBe('some-run-id');
});

it('uses provided runId', () => {
  const tracker = makeTracker('my-custom-run-id');
  expect(tracker.getTrackData().runId).toBe('my-custom-run-id');
});

// ---------------------------------------------------------------------------
// resumptionToken round-trip
// ---------------------------------------------------------------------------

it('encodes a resumption token with correct field order', () => {
  const tracker = makeTracker('550e8400-e29b-41d4-a716-446655440000');
  const token = tracker.resumptionToken;
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  expect(decoded).toBe(
    '{"runId":"550e8400-e29b-41d4-a716-446655440000","graphKey":"my-agent-graph","variationKey":"v1","version":2}',
  );
});

it('omits variationKey from token when not set', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    'run-abc',
    graphKey,
    undefined,
    version,
    testContext,
  );
  const token = tracker.resumptionToken;
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  expect(decoded).toBe('{"runId":"run-abc","graphKey":"my-agent-graph","version":2}');
});

it('fromResumptionToken reconstructs the tracker with original runId', () => {
  const original = makeTracker('orig-run-id');
  const token = original.resumptionToken;

  const reconstructed = LDGraphTrackerImpl.fromResumptionToken(token, mockLdClient, testContext);
  expect(reconstructed.getTrackData()).toEqual({
    runId: 'orig-run-id',
    graphKey,
    version,
    variationKey,
  });
});

// ---------------------------------------------------------------------------
// getSummary
// ---------------------------------------------------------------------------

it('returns an empty summary initially', () => {
  const tracker = makeTracker('r');
  expect(tracker.getSummary()).toEqual({});
});

it('returns a copy of the summary (not a reference)', () => {
  const tracker = makeTracker('r');
  tracker.trackInvocationSuccess();
  const summary1 = tracker.getSummary();
  const summary2 = tracker.getSummary();
  expect(summary1).not.toBe(summary2);
  expect(summary1).toEqual(summary2);
});

// ---------------------------------------------------------------------------
// trackInvocationSuccess / trackInvocationFailure – at-most-once
// ---------------------------------------------------------------------------

it('trackInvocationSuccess sets success=true and emits event', () => {
  const tracker = makeTracker('r');
  tracker.trackInvocationSuccess();
  expect(tracker.getSummary().success).toBe(true);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:invocation_success',
    testContext,
    tracker.getTrackData(),
    1,
  );
});

it('trackInvocationFailure sets success=false and emits event', () => {
  const tracker = makeTracker('r');
  tracker.trackInvocationFailure();
  expect(tracker.getSummary().success).toBe(false);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:invocation_failure',
    testContext,
    tracker.getTrackData(),
    1,
  );
});

it('drops second trackInvocationSuccess call and warns', () => {
  const tracker = makeTracker('r');
  tracker.trackInvocationSuccess();
  tracker.trackInvocationSuccess();
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockWarn).toHaveBeenCalledWith(
    expect.stringContaining('invocation success/failure already recorded for this run'),
  );
});

it('drops trackInvocationFailure after trackInvocationSuccess and warns', () => {
  const tracker = makeTracker('r');
  tracker.trackInvocationSuccess();
  tracker.trackInvocationFailure();
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockWarn).toHaveBeenCalledWith(
    expect.stringContaining('invocation success/failure already recorded for this run'),
  );
});

// ---------------------------------------------------------------------------
// trackLatency – at-most-once
// ---------------------------------------------------------------------------

it('trackLatency sets durationMs and emits event', () => {
  const tracker = makeTracker('r');
  tracker.trackLatency(1234);
  expect(tracker.getSummary().durationMs).toBe(1234);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:latency',
    testContext,
    tracker.getTrackData(),
    1234,
  );
});

it('drops second trackLatency call and warns', () => {
  const tracker = makeTracker('r');
  tracker.trackLatency(100);
  tracker.trackLatency(200);
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(tracker.getSummary().durationMs).toBe(100);
  expect(mockWarn).toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// trackTotalTokens – at-most-once
// ---------------------------------------------------------------------------

it('trackTotalTokens sets tokens and emits event with total as metric value', () => {
  const tracker = makeTracker('r');
  const tokens = { total: 500, input: 200, output: 300 };
  tracker.trackTotalTokens(tokens);
  expect(tracker.getSummary().tokens).toEqual(tokens);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:total_tokens',
    testContext,
    tracker.getTrackData(),
    500,
  );
});

it('drops second trackTotalTokens call and warns', () => {
  const tracker = makeTracker('r');
  tracker.trackTotalTokens({ total: 100, input: 50, output: 50 });
  tracker.trackTotalTokens({ total: 200, input: 100, output: 100 });
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(tracker.getSummary().tokens?.total).toBe(100);
  expect(mockWarn).toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// trackPath – at-most-once
// ---------------------------------------------------------------------------

it('trackPath sets path and emits event with path in data payload', () => {
  const tracker = makeTracker('r');
  const path = ['root-agent', 'research-agent', 'write-agent'];
  tracker.trackPath(path);
  expect(tracker.getSummary().path).toEqual(path);
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:path',
    testContext,
    { ...tracker.getTrackData(), path },
    1,
  );
});

it('drops second trackPath call and warns', () => {
  const tracker = makeTracker('r');
  tracker.trackPath(['a', 'b']);
  tracker.trackPath(['c', 'd']);
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(tracker.getSummary().path).toEqual(['a', 'b']);
  expect(mockWarn).toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Edge-level methods – multi-fire, NOT at-most-once
// ---------------------------------------------------------------------------

it('trackRedirect emits event with sourceKey and redirectedTarget', () => {
  const tracker = makeTracker('r');
  tracker.trackRedirect('source-agent', 'redirected-agent');
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:redirect',
    testContext,
    { ...tracker.getTrackData(), sourceKey: 'source-agent', redirectedTarget: 'redirected-agent' },
    1,
  );
});

it('trackHandoffSuccess emits event with sourceKey and targetKey', () => {
  const tracker = makeTracker('r');
  tracker.trackHandoffSuccess('agent-a', 'agent-b');
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:handoff_success',
    testContext,
    { ...tracker.getTrackData(), sourceKey: 'agent-a', targetKey: 'agent-b' },
    1,
  );
});

it('trackHandoffFailure emits event with sourceKey and targetKey', () => {
  const tracker = makeTracker('r');
  tracker.trackHandoffFailure('agent-a', 'agent-b');
  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:handoff_failure',
    testContext,
    { ...tracker.getTrackData(), sourceKey: 'agent-a', targetKey: 'agent-b' },
    1,
  );
});

it('edge-level methods can fire multiple times without warning', () => {
  const tracker = makeTracker('r');
  tracker.trackHandoffSuccess('a', 'b');
  tracker.trackHandoffSuccess('a', 'b');
  tracker.trackRedirect('a', 'c');
  tracker.trackHandoffFailure('x', 'y');
  expect(mockTrack).toHaveBeenCalledTimes(4);
  expect(mockWarn).not.toHaveBeenCalled();
});
