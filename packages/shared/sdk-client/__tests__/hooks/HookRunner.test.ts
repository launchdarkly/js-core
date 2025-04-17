import { LDContext, LDEvaluationDetail, LDLogger } from '@launchdarkly/js-sdk-common';

import { Hook, IdentifySeriesResult } from '../../src/api/integrations/Hooks';
import HookRunner from '../../src/HookRunner';
import { TestHook } from './TestHook';

describe('given a hook runner and test hook', () => {
  let logger: LDLogger;
  let testHook: Hook;
  let hookRunner: HookRunner;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    testHook = {
      getMetadata: jest.fn().mockReturnValue({ name: 'Test Hook' }),
      beforeEvaluation: jest.fn(),
      afterEvaluation: jest.fn(),
      beforeIdentify: jest.fn(),
      afterIdentify: jest.fn(),
      afterTrack: jest.fn(),
    };

    hookRunner = new HookRunner(logger, [testHook]);
  });

  describe('when evaluating flags', () => {
    it('should execute hooks and return the evaluation result', () => {
      const key = 'test-flag';
      const context: LDContext = { kind: 'user', key: 'user-123' };
      const defaultValue = false;
      const evaluationResult: LDEvaluationDetail = {
        value: true,
        variationIndex: 1,
        reason: { kind: 'OFF' },
      };

      const method = jest.fn().mockReturnValue(evaluationResult);

      const result = hookRunner.withEvaluation(key, context, defaultValue, method);

      expect(testHook.beforeEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          flagKey: key,
          context,
          defaultValue,
        }),
        {},
      );

      expect(method).toHaveBeenCalled();

      expect(testHook.afterEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          flagKey: key,
          context,
          defaultValue,
        }),
        {},
        evaluationResult,
      );

      expect(result).toEqual(evaluationResult);
    });

    it('should handle errors in hooks', () => {
      const errorHook: Hook = {
        getMetadata: jest.fn().mockReturnValue({ name: 'Error Hook' }),
        beforeEvaluation: jest.fn().mockImplementation(() => {
          throw new Error('Hook error');
        }),
        afterEvaluation: jest.fn(),
      };

      const errorHookRunner = new HookRunner(logger, [errorHook]);

      const method = jest
        .fn()
        .mockReturnValue({ value: true, variationIndex: 1, reason: { kind: 'OFF' } });

      errorHookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, method);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'An error was encountered in "beforeEvaluation" of the "Error Hook" hook: Error: Hook error',
        ),
      );
    });

    it('should skip hook execution if there are no hooks', () => {
      const emptyHookRunner = new HookRunner(logger, []);
      const method = jest
        .fn()
        .mockReturnValue({ value: true, variationIndex: 1, reason: { kind: 'OFF' } });

      emptyHookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, method);

      expect(method).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should pass evaluation series data from before to after hooks', () => {
      const key = 'test-flag';
      const context: LDContext = { kind: 'user', key: 'user-123' };
      const defaultValue = false;
      const evaluationResult: LDEvaluationDetail = {
        value: true,
        variationIndex: 1,
        reason: { kind: 'OFF' },
      };

      testHook.beforeEvaluation = jest
        .fn()
        .mockImplementation((_, series) => ({ ...series, testData: 'before data' }));

      testHook.afterEvaluation = jest.fn();

      const method = jest.fn().mockReturnValue(evaluationResult);

      hookRunner.withEvaluation(key, context, defaultValue, method);

      expect(testHook.beforeEvaluation).toHaveBeenCalled();
      expect(testHook.afterEvaluation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ testData: 'before data' }),
        evaluationResult,
      );
    });
  });

  describe('when handling an identification', () => {
    it('should execute identify hooks', () => {
      const context: LDContext = { kind: 'user', key: 'user-123' };
      const timeout = 10;
      const identifyResult: IdentifySeriesResult = { status: 'completed' };

      const identifyCallback = hookRunner.identify(context, timeout);
      identifyCallback(identifyResult);

      expect(testHook.beforeIdentify).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          timeout,
        }),
        {},
      );

      expect(testHook.afterIdentify).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
          timeout,
        }),
        {},
        identifyResult,
      );
    });

    it('should handle errors in identify hooks', () => {
      const errorHook: Hook = {
        getMetadata: jest.fn().mockReturnValue({ name: 'Error Hook' }),
        beforeIdentify: jest.fn().mockImplementation(() => {
          throw new Error('Hook error');
        }),
        afterIdentify: jest.fn(),
      };

      const errorHookRunner = new HookRunner(logger, [errorHook]);

      const identifyCallback = errorHookRunner.identify({ kind: 'user', key: 'user-123' }, 1000);
      identifyCallback({ status: 'error' });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'An error was encountered in "beforeEvaluation" of the "Error Hook" hook: Error: Hook error',
        ),
      );
    });

    it('should pass identify series data from before to after hooks', () => {
      const context: LDContext = { kind: 'user', key: 'user-123' };
      const timeout = 10;
      const identifyResult: IdentifySeriesResult = { status: 'completed' };

      testHook.beforeIdentify = jest
        .fn()
        .mockImplementation((_, series) => ({ ...series, testData: 'before identify data' }));

      testHook.afterIdentify = jest.fn();

      const identifyCallback = hookRunner.identify(context, timeout);
      identifyCallback(identifyResult);

      expect(testHook.beforeIdentify).toHaveBeenCalled();
      expect(testHook.afterIdentify).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ testData: 'before identify data' }),
        identifyResult,
      );
    });
  });

  it('should use the added hook in future invocations', () => {
    const newHook: Hook = {
      getMetadata: jest.fn().mockReturnValue({ name: 'New Hook' }),
      beforeEvaluation: jest.fn(),
      afterEvaluation: jest.fn(),
    };

    hookRunner.addHook(newHook);

    const method = jest
      .fn()
      .mockReturnValue({ value: true, variationIndex: 1, reason: { kind: 'OFF' } });

    hookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, method);

    expect(newHook.beforeEvaluation).toHaveBeenCalled();
    expect(newHook.afterEvaluation).toHaveBeenCalled();
  });

  it('should log "unknown hook" when getMetadata throws an error', () => {
    const errorHook: Hook = {
      getMetadata: jest.fn().mockImplementation(() => {
        throw new Error('Metadata error');
      }),
      beforeEvaluation: jest.fn().mockImplementation(() => {
        throw new Error('Test error in beforeEvaluation');
      }),
      afterEvaluation: jest.fn(),
    };

    const errorHookRunner = new HookRunner(logger, [errorHook]);

    errorHookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, () => ({
      value: true,
      variationIndex: 1,
      reason: { kind: 'OFF' },
    }));

    expect(logger.error).toHaveBeenCalledWith(
      'Exception thrown getting metadata for hook. Unable to get hook name.',
    );

    // Verify that the error was logged with the correct hook name
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'An error was encountered in "beforeEvaluation" of the "unknown hook" hook: Error: Test error in beforeEvaluation',
      ),
    );
  });

  it('should log "unknown hook" when getMetadata returns an empty name', () => {
    const errorHook: Hook = {
      getMetadata: jest.fn().mockImplementation(() => ({
        name: '',
      })),
      beforeEvaluation: jest.fn().mockImplementation(() => {
        throw new Error('Test error in beforeEvaluation');
      }),
      afterEvaluation: jest.fn(),
    };

    const errorHookRunner = new HookRunner(logger, [errorHook]);

    errorHookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, () => ({
      value: true,
      variationIndex: 1,
      reason: { kind: 'OFF' },
    }));

    // Verify that the error was logged with the correct hook name
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'An error was encountered in "beforeEvaluation" of the "unknown hook" hook: Error: Test error in beforeEvaluation',
      ),
    );
  });

  it('should log the correct hook name when an error occurs', () => {
    // Modify the testHook to throw an error in beforeEvaluation
    testHook.beforeEvaluation = jest.fn().mockImplementation(() => {
      throw new Error('Test error in beforeEvaluation');
    });

    hookRunner.withEvaluation('test-flag', { kind: 'user', key: 'user-123' }, false, () => ({
      value: true,
      variationIndex: 1,
      reason: { kind: 'OFF' },
    }));

    // Verify that getMetadata was called to get the hook name
    expect(testHook.getMetadata).toHaveBeenCalled();

    // Verify that the error was logged with the correct hook name
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'An error was encountered in "beforeEvaluation" of the "Test Hook" hook: Error: Test error in beforeEvaluation',
      ),
    );
  });

  it('should execute afterTrack hooks', () => {
    const context: LDContext = { kind: 'user', key: 'user-123' };
    const key = 'test';
    const data = { test: 'data' };
    const metricValue = 42;

    const trackContext = {
      key,
      context,
      data,
      metricValue,
    };

    testHook.afterTrack = jest.fn();

    hookRunner.afterTrack(trackContext);

    expect(testHook.afterTrack).toHaveBeenCalledWith(trackContext);
  });

  it('should handle errors in afterTrack hooks', () => {
    const errorHook: Hook = {
      getMetadata: jest.fn().mockReturnValue({ name: 'Error Hook' }),
      afterTrack: jest.fn().mockImplementation(() => {
        throw new Error('Hook error');
      }),
    };

    const errorHookRunner = new HookRunner(logger, [errorHook]);

    errorHookRunner.afterTrack({
      key: 'test',
      context: { kind: 'user', key: 'user-123' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'An error was encountered in "afterTrack" of the "Error Hook" hook: Error: Hook error',
      ),
    );
  });

  it('should skip afterTrack execution if there are no hooks', () => {
    const emptyHookRunner = new HookRunner(logger, []);

    emptyHookRunner.afterTrack({
      key: 'test',
      context: { kind: 'user', key: 'user-123' },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('executes hook stages in the specified order', () => {
    const beforeEvalOrder: string[] = [];
    const afterEvalOrder: string[] = [];
    const beforeIdentifyOrder: string[] = [];
    const afterIdentifyOrder: string[] = [];
    const afterTrackOrder: string[] = [];

    const hookA = new TestHook();
    hookA.beforeEvalImpl = (_context, data) => {
      beforeEvalOrder.push('a');
      return data;
    };
    hookA.afterEvalImpl = (_context, data, _detail) => {
      afterEvalOrder.push('a');
      return data;
    };
    hookA.beforeIdentifyImpl = (_context, data) => {
      beforeIdentifyOrder.push('a');
      return data;
    };
    hookA.afterIdentifyImpl = (_context, data, _result) => {
      afterIdentifyOrder.push('a');
      return data;
    };
    hookA.afterTrackImpl = () => {
      afterTrackOrder.push('a');
    };

    const hookB = new TestHook();
    hookB.beforeEvalImpl = (_context, data) => {
      beforeEvalOrder.push('b');
      return data;
    };
    hookB.afterEvalImpl = (_context, data, _detail) => {
      afterEvalOrder.push('b');
      return data;
    };
    hookB.beforeIdentifyImpl = (_context, data) => {
      beforeIdentifyOrder.push('b');
      return data;
    };
    hookB.afterIdentifyImpl = (_context, data, _result) => {
      afterIdentifyOrder.push('b');
      return data;
    };
    hookB.afterTrackImpl = () => {
      afterTrackOrder.push('b');
    };

    const hookC = new TestHook();
    hookC.beforeEvalImpl = (_context, data) => {
      beforeEvalOrder.push('c');
      return data;
    };
    hookC.afterEvalImpl = (_context, data, _detail) => {
      afterEvalOrder.push('c');
      return data;
    };
    hookC.beforeIdentifyImpl = (_context, data) => {
      beforeIdentifyOrder.push('c');
      return data;
    };
    hookC.afterIdentifyImpl = (_context, data, _result) => {
      afterIdentifyOrder.push('c');
      return data;
    };
    hookC.afterTrackImpl = () => {
      afterTrackOrder.push('c');
    };

    const runner = new HookRunner(logger, [hookA, hookB]);
    runner.addHook(hookC);

    // Test evaluation order
    runner.withEvaluation('flagKey', { kind: 'user', key: 'bob' }, 'default', () => ({
      value: false,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
      variationIndex: null,
    }));

    // Test identify order
    const identifyCallback = runner.identify({ kind: 'user', key: 'bob' }, 1000);
    identifyCallback({ status: 'completed' });

    // Test track order
    runner.afterTrack({
      key: 'test',
      context: { kind: 'user', key: 'bob' },
      data: { test: 'data' },
      metricValue: 42,
    });

    // Verify evaluation hooks order
    expect(beforeEvalOrder).toEqual(['a', 'b', 'c']);
    expect(afterEvalOrder).toEqual(['c', 'b', 'a']);

    // Verify identify hooks order
    expect(beforeIdentifyOrder).toEqual(['a', 'b', 'c']);
    expect(afterIdentifyOrder).toEqual(['c', 'b', 'a']);

    // Verify track hooks order
    expect(afterTrackOrder).toEqual(['c', 'b', 'a']);
  });
});
