import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import {
  createConditionGroup,
  createFallbackCondition,
  createRecoveryCondition,
  getConditions,
} from '../../../src/datasource/fdv2/Conditions';
import {
  changeSet,
  FDv2SourceResult,
  interrupted,
  shutdown,
} from '../../../src/datasource/fdv2/FDv2SourceResult';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Flush deeply-chained microtasks. cancelableTimedPromise introduces extra
 * promise layers compared to raw setTimeout, so we need multiple ticks.
 */
async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function makeInterrupted(): FDv2SourceResult {
  return interrupted(
    { kind: DataSourceErrorKind.NetworkError, message: 'test error', time: Date.now() },
    false,
  );
}

function makeChangeSet(): FDv2SourceResult {
  return changeSet(
    { id: 'test', version: 1, state: 'test-state', type: 'full', updates: [] },
    false,
  );
}

describe('createFallbackCondition', () => {
  it('does not fire without an interrupted result', async () => {
    const condition = createFallbackCondition(1000);

    let resolved = false;
    condition.promise.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(2000);
    await flushMicrotasks();

    expect(resolved).toBe(false);
    condition.close();
  });

  it('fires after timeout following an interrupted result', async () => {
    const condition = createFallbackCondition(1000);

    condition.inform(makeInterrupted());

    jest.advanceTimersByTime(999);
    await flushMicrotasks();

    let result: string | undefined;
    condition.promise.then((r) => {
      result = r;
    });
    await flushMicrotasks();
    expect(result).toBeUndefined();

    jest.advanceTimersByTime(1);
    // Flush microtask queue
    await flushMicrotasks();

    expect(result).toBe('fallback');
    condition.close();
  });

  it('cancels timer when a changeSet is received', async () => {
    const condition = createFallbackCondition(1000);

    condition.inform(makeInterrupted());
    jest.advanceTimersByTime(500);

    // Cancel via changeSet
    condition.inform(makeChangeSet());

    let resolved = false;
    condition.promise.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(resolved).toBe(false);
    condition.close();
  });

  it('restarts timer on subsequent interrupted results after cancellation', async () => {
    const condition = createFallbackCondition(1000);

    // First interrupted
    condition.inform(makeInterrupted());
    jest.advanceTimersByTime(500);

    // Cancel with changeSet
    condition.inform(makeChangeSet());

    // New interrupted
    condition.inform(makeInterrupted());

    let result: string | undefined;
    condition.promise.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(999);
    await flushMicrotasks();
    expect(result).toBeUndefined();

    jest.advanceTimersByTime(1);
    await flushMicrotasks();

    expect(result).toBe('fallback');
    condition.close();
  });

  it('does not start a second timer for duplicate interrupted results', async () => {
    const condition = createFallbackCondition(1000);

    condition.inform(makeInterrupted());
    jest.advanceTimersByTime(500);

    // Second interrupted should not reset the timer
    condition.inform(makeInterrupted());

    let result: string | undefined;
    condition.promise.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(500);
    await flushMicrotasks();

    // Should fire at 1000ms from first interrupted, not 1500ms
    expect(result).toBe('fallback');
    condition.close();
  });

  it('does not fire after close', async () => {
    const condition = createFallbackCondition(1000);

    condition.inform(makeInterrupted());
    condition.close();

    let resolved = false;
    condition.promise.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(2000);
    await flushMicrotasks();

    expect(resolved).toBe(false);
  });

  it('ignores inform after close', () => {
    const condition = createFallbackCondition(1000);
    condition.close();

    // Should not throw
    condition.inform(makeInterrupted());
    condition.inform(makeChangeSet());
  });
});

describe('createRecoveryCondition', () => {
  it('fires after timeout', async () => {
    const condition = createRecoveryCondition(5000);

    let result: string | undefined;
    condition.promise.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(4999);
    await flushMicrotasks();
    expect(result).toBeUndefined();

    jest.advanceTimersByTime(1);
    await flushMicrotasks();

    expect(result).toBe('recovery');
    condition.close();
  });

  it('ignores inform calls', async () => {
    const condition = createRecoveryCondition(1000);

    // Inform should not affect the timer
    condition.inform(makeInterrupted());
    condition.inform(makeChangeSet());
    condition.inform(shutdown());

    let result: string | undefined;
    condition.promise.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('recovery');
    condition.close();
  });

  it('does not fire after close', async () => {
    const condition = createRecoveryCondition(1000);
    condition.close();

    let resolved = false;
    condition.promise.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(2000);
    await flushMicrotasks();

    expect(resolved).toBe(false);
  });
});

describe('createConditionGroup', () => {
  it('returns undefined promise for empty group', () => {
    const group = createConditionGroup([]);
    expect(group.promise).toBeUndefined();
  });

  it('races conditions and resolves with the first to fire', async () => {
    const fallback = createFallbackCondition(1000);
    const recovery = createRecoveryCondition(5000);
    const group = createConditionGroup([fallback, recovery]);

    expect(group.promise).toBeDefined();

    // Trigger fallback via interrupted
    group.inform(makeInterrupted());

    let result: string | undefined;
    group.promise!.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('fallback');
    group.close();
  });

  it('recovery fires first when no interrupted result is received', async () => {
    const fallback = createFallbackCondition(10_000);
    const recovery = createRecoveryCondition(1000);
    const group = createConditionGroup([fallback, recovery]);

    let result: string | undefined;
    group.promise!.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('recovery');
    group.close();
  });

  it('broadcasts inform to all conditions', async () => {
    const fallback = createFallbackCondition(1000);
    const recovery = createRecoveryCondition(5000);
    const group = createConditionGroup([fallback, recovery]);

    const interruptedResult = makeInterrupted();
    group.inform(interruptedResult);

    // The fallback should have started its timer. We can verify by checking
    // that advancing time causes it to fire.
    let result: string | undefined;
    group.promise!.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('fallback');
    group.close();
  });

  it('close stops all conditions', async () => {
    const fallback = createFallbackCondition(1000);
    const recovery = createRecoveryCondition(1000);
    const group = createConditionGroup([fallback, recovery]);

    group.inform(makeInterrupted());
    group.close();

    let resolved = false;
    group.promise!.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(2000);
    await flushMicrotasks();

    expect(resolved).toBe(false);
  });
});

describe('getConditions', () => {
  it('returns empty group when only one synchronizer is available', () => {
    const group = getConditions(1, true, 1000, 5000);
    expect(group.promise).toBeUndefined();
  });

  it('returns empty group when zero synchronizers are available', () => {
    const group = getConditions(0, true, 1000, 5000);
    expect(group.promise).toBeUndefined();
  });

  it('returns fallback only for prime synchronizer', async () => {
    const group = getConditions(2, true, 1000, 50_000);

    group.inform(makeInterrupted());

    let result: string | undefined;
    group.promise!.then((r) => {
      result = r;
    });

    // Fallback should fire at 1000ms
    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('fallback');
    group.close();
  });

  it('returns fallback + recovery for non-prime synchronizer', async () => {
    const group = getConditions(2, false, 10_000, 1000);

    // Recovery starts immediately and should fire first at 1000ms
    let result: string | undefined;
    group.promise!.then((r) => {
      result = r;
    });

    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(result).toBe('recovery');
    group.close();
  });
});
