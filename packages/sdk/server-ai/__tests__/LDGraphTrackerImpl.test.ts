import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDClientMin } from '../src/LDClientMin';
import { LDGraphTrackerImpl } from '../src/LDGraphTrackerImpl';

const mockTrack = jest.fn();
const mockLdClient: LDClientMin = {
  track: mockTrack,
  variation: jest.fn(),
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };
const graphKey = 'test-graph';
const variationKey = 'v1';
const version = 2;

const getExpectedTrackData = () => ({
  graphKey,
  variationKey,
  version,
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('returns track data', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );

  expect(tracker.getTrackData()).toEqual(getExpectedTrackData());
});

it('tracks invocation success', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackInvocationSuccess();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:invocation_success',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

it('tracks invocation failure', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackInvocationFailure();

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:invocation_failure',
    testContext,
    getExpectedTrackData(),
    1,
  );
});

it('tracks latency', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackLatency(1500);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:latency',
    testContext,
    getExpectedTrackData(),
    1500,
  );
});

it('tracks total tokens', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackTotalTokens({ total: 200, input: 80, output: 120 });

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:total_tokens',
    testContext,
    getExpectedTrackData(),
    200,
  );
});

it('does not track total tokens when total is zero', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackTotalTokens({ total: 0, input: 0, output: 0 });

  expect(mockTrack).not.toHaveBeenCalled();
});

it('tracks path', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  const path = ['node-a', 'node-b', 'node-c'];
  tracker.trackPath(path);

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:path',
    testContext,
    { ...getExpectedTrackData(), path },
    1,
  );
});

it('tracks judge result', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackJudgeResult({
    judgeConfigKey: 'my-judge',
    success: true,
    sampled: true,
    score: 0.9,
    reasoning: 'Relevant',
    metricKey: 'relevance',
  });

  expect(mockTrack).toHaveBeenCalledWith(
    'relevance',
    testContext,
    { ...getExpectedTrackData(), judgeConfigKey: 'my-judge' },
    0.9,
  );
});

it('tracks judge result without judgeConfigKey', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackJudgeResult({
    success: true,
    sampled: true,
    score: 0.7,
    reasoning: 'Somewhat relevant',
    metricKey: 'relevance',
  });

  expect(mockTrack).toHaveBeenCalledWith('relevance', testContext, getExpectedTrackData(), 0.7);
});

it('does not track judge result when not sampled', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackJudgeResult({
    judgeConfigKey: 'my-judge',
    success: false,
    sampled: false,
  });

  expect(mockTrack).not.toHaveBeenCalled();
});

it('does not track judge result when success is false', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackJudgeResult({
    judgeConfigKey: 'my-judge',
    success: false,
    sampled: true,
    score: 0.9,
    metricKey: 'relevance',
  });

  expect(mockTrack).not.toHaveBeenCalled();
});

it('tracks redirect', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackRedirect('agent-a', 'agent-b');

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:redirect',
    testContext,
    { ...getExpectedTrackData(), sourceKey: 'agent-a', redirectedTarget: 'agent-b' },
    1,
  );
});

it('tracks handoff success', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackHandoffSuccess('agent-a', 'agent-b');

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:handoff_success',
    testContext,
    { ...getExpectedTrackData(), sourceKey: 'agent-a', targetKey: 'agent-b' },
    1,
  );
});

it('tracks handoff failure', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );
  tracker.trackHandoffFailure('agent-a', 'agent-b');

  expect(mockTrack).toHaveBeenCalledWith(
    '$ld:ai:graph:handoff_failure',
    testContext,
    { ...getExpectedTrackData(), sourceKey: 'agent-a', targetKey: 'agent-b' },
    1,
  );
});

it('returns empty summary when no metrics tracked', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );

  expect(tracker.getSummary()).toEqual({});
});

it('summarizes tracked graph metrics', () => {
  const tracker = new LDGraphTrackerImpl(
    mockLdClient,
    graphKey,
    variationKey,
    version,
    testContext,
  );

  tracker.trackInvocationSuccess();
  tracker.trackLatency(2000);
  tracker.trackTotalTokens({ total: 300, input: 100, output: 200 });
  tracker.trackPath(['node-a', 'node-b']);

  expect(tracker.getSummary()).toEqual({
    success: true,
    durationMs: 2000,
    tokens: { total: 300, input: 100, output: 200 },
    path: ['node-a', 'node-b'],
  });
});

describe('at-most-once semantics for graph-level metrics', () => {
  it('drops duplicate trackInvocationSuccess calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackInvocationSuccess();
    tracker.trackInvocationSuccess();

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('drops trackInvocationFailure after trackInvocationSuccess', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackInvocationSuccess();
    tracker.trackInvocationFailure();

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:graph:invocation_success',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('drops duplicate trackLatency calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackLatency(1000);
    tracker.trackLatency(2000);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:graph:latency',
      testContext,
      getExpectedTrackData(),
      1000,
    );
  });

  it('drops duplicate trackTotalTokens calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackTotalTokens({ total: 100, input: 40, output: 60 });
    tracker.trackTotalTokens({ total: 200, input: 80, output: 120 });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:graph:total_tokens',
      testContext,
      getExpectedTrackData(),
      100,
    );
  });

  it('drops duplicate trackPath calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackPath(['node-a']);
    tracker.trackPath(['node-b', 'node-c']);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      '$ld:ai:graph:path',
      testContext,
      { ...getExpectedTrackData(), path: ['node-a'] },
      1,
    );
  });
});

describe('edge-level methods can be called multiple times', () => {
  it('allows multiple trackRedirect calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackRedirect('a', 'b');
    tracker.trackRedirect('b', 'c');

    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('allows multiple trackHandoffSuccess calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackHandoffSuccess('a', 'b');
    tracker.trackHandoffSuccess('b', 'c');

    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('allows multiple trackHandoffFailure calls', () => {
    const tracker = new LDGraphTrackerImpl(
      mockLdClient,
      graphKey,
      variationKey,
      version,
      testContext,
    );
    tracker.trackHandoffFailure('a', 'b');
    tracker.trackHandoffFailure('b', 'c');

    expect(mockTrack).toHaveBeenCalledTimes(2);
  });
});
