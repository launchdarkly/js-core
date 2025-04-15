import { integrations } from '../../src';
import Reasons from '../../src/evaluation/Reasons';
import HookRunner from '../../src/hooks/HookRunner';
import TestLogger, { LogLevel } from '../Logger';
import { TestHook } from './TestHook';

const defaultUser = { kind: 'user', key: 'user-key' };

describe('given a HookRunner', () => {
  let testHook: TestHook;
  let logger: TestLogger;
  let runner: HookRunner;

  beforeEach(async () => {
    logger = new TestLogger();
    testHook = new TestHook();
    runner = new HookRunner(logger, [testHook]);
  });

  it('propagates data between stages', async () => {
    testHook.beforeEvalImpl = (
      _hookContext: integrations.EvaluationSeriesContext,
      data: integrations.EvaluationSeriesData,
    ) => ({
      ...data,
      added: 'added data',
    });

    await runner.withEvaluationSeries(
      'flagKey',
      defaultUser,
      false,
      'LDClient.variation',
      async () => ({
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      }),
      '12345',
    );

    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
        environmentId: '12345',
      },
      { added: 'added data' },
      {
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      },
    );
  });

  it('handles an exception thrown in beforeEvaluation', async () => {
    testHook.beforeEvalImpl = (
      _hookContext: integrations.EvaluationSeriesContext,
      _data: integrations.EvaluationSeriesData,
    ) => {
      throw new Error('bad hook');
    };

    await runner.withEvaluationSeries(
      'flagKey',
      defaultUser,
      false,
      'LDClient.variation',
      async () => ({
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      }),
    );

    logger.expectMessages([
      {
        level: LogLevel.Error,
        matches:
          /An error was encountered in "beforeEvaluation" of the "LaunchDarkly Test Hook" hook: Error: bad hook/,
      },
    ]);
  });

  it('handles an exception thrown in afterEvaluation', async () => {
    testHook.afterEvalImpl = () => {
      throw new Error('bad hook');
    };
    await runner.withEvaluationSeries(
      'flagKey',
      defaultUser,
      false,
      'LDClient.variation',
      async () => ({
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      }),
    );
    logger.expectMessages([
      {
        level: LogLevel.Error,
        matches:
          /An error was encountered in "afterEvaluation" of the "LaunchDarkly Test Hook" hook: Error: bad hook/,
      },
    ]);
  });

  it('handles exception getting the hook metadata', async () => {
    testHook.getMetadataImpl = () => {
      throw new Error('bad hook');
    };
    await runner.withEvaluationSeries(
      'flagKey',
      defaultUser,
      false,
      'LDClient.variation',
      async () => ({
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      }),
    );

    logger.expectMessages([
      {
        level: LogLevel.Error,
        matches: /Exception thrown getting metadata for hook. Unable to get hook name./,
      },
    ]);
  });

  it('uses unknown name when the name cannot be accessed', async () => {
    testHook.beforeEvalImpl = (
      _hookContext: integrations.EvaluationSeriesContext,
      _data: integrations.EvaluationSeriesData,
    ) => {
      throw new Error('bad hook');
    };
    testHook.getMetadataImpl = () => {
      throw new Error('bad hook');
    };
    testHook.afterEvalImpl = () => {
      throw new Error('bad hook');
    };
    await runner.withEvaluationSeries(
      'flagKey',
      defaultUser,
      false,
      'LDClient.variation',
      async () => ({
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      }),
    );
    logger.expectMessages([
      {
        level: LogLevel.Error,
        matches:
          /An error was encountered in "afterEvaluation" of the "unknown hook" hook: Error: bad hook/,
      },
      {
        level: LogLevel.Error,
        matches:
          /An error was encountered in "beforeEvaluation" of the "unknown hook" hook: Error: bad hook/,
      },
    ]);
  });
});

it('can add a hook after initialization', async () => {
  const logger = new TestLogger();
  const runner = new HookRunner(logger, []);

  const testHook = new TestHook();
  runner.addHook(testHook);

  await runner.withEvaluationSeries(
    'flagKey',
    defaultUser,
    false,
    'LDClient.variation',
    async () => ({
      value: true,
      reason: { kind: 'FALLTHROUGH' },
      variationIndex: 0,
    }),
    '12345',
  );
  testHook.verifyBefore(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
      environmentId: '12345',
    },
    {},
  );
  testHook.verifyAfter(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
      environmentId: '12345',
    },
    {},
    {
      value: true,
      reason: Reasons.Fallthrough,
      variationIndex: 0,
    },
  );
});

it('executes hook stages in the specified order', async () => {
  const beforeCalledOrder: string[] = [];
  const afterCalledOrder: string[] = [];

  const hookA = new TestHook();
  hookA.beforeEvalImpl = (_context, data) => {
    beforeCalledOrder.push('a');
    return data;
  };

  hookA.afterEvalImpl = (_context, data, _detail) => {
    afterCalledOrder.push('a');
    return data;
  };

  const hookB = new TestHook();
  hookB.beforeEvalImpl = (_context, data) => {
    beforeCalledOrder.push('b');
    return data;
  };
  hookB.afterEvalImpl = (_context, data, _detail) => {
    afterCalledOrder.push('b');
    return data;
  };

  const hookC = new TestHook();
  hookC.beforeEvalImpl = (_context, data) => {
    beforeCalledOrder.push('c');
    return data;
  };

  hookC.afterEvalImpl = (_context, data, _detail) => {
    afterCalledOrder.push('c');
    return data;
  };

  const logger = new TestLogger();
  const runner = new HookRunner(logger, [hookA, hookB]);

  const testHook = new TestHook();
  runner.addHook(testHook);
  runner.addHook(hookC);
  await runner.withEvaluationSeries(
    'flagKey',
    defaultUser,
    false,
    'LDClient.variation',
    async () => ({
      value: false,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
      variationIndex: null,
    }),
  );

  expect(beforeCalledOrder).toEqual(['a', 'b', 'c']);
  expect(afterCalledOrder).toEqual(['c', 'b', 'a']);
});

it('can return custom data', async () => {
  const runner = new HookRunner(undefined, []);
  const res = await runner.withEvaluationSeriesExtraDetail(
    'flagKey',
    defaultUser,
    false,
    'LDClient.variation',
    async () => ({
      detail: {
        value: false,
        reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
        variationIndex: null,
      },
      test: 'test',
    }),
  );
  expect(res.test).toEqual('test');
});
