import { basicPlatform } from '@launchdarkly/private-js-mocks';

import { integrations, LDClientImpl, LDEvaluationDetail, LDMigrationStage } from '../src';
import Reasons from '../src/evaluation/Reasons';
import TestData from '../src/integrations/test_data/TestData';
import TestLogger, { LogLevel } from './Logger';
import makeCallbacks from './makeCallbacks';

const defaultUser = { kind: 'user', key: 'user-key' };

type EvalCapture = {
  method: string;
  hookContext: integrations.EvaluationSeriesContext;
  hookData: integrations.EvaluationSeriesData;
  detail?: LDEvaluationDetail;
};

class TestHook implements integrations.Hook {
  captureBefore: EvalCapture[] = [];
  captureAfter: EvalCapture[] = [];

  getMetadataImpl: () => integrations.HookMetadata = () => ({ name: 'LaunchDarkly Test Hook' });

  getMetadata(): integrations.HookMetadata {
    return this.getMetadataImpl();
  }

  verifyBefore(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ) {
    expect(this.captureBefore).toHaveLength(1);
    expect(this.captureBefore[0].hookContext).toEqual(hookContext);
    expect(this.captureBefore[0].hookData).toEqual(data);
  }

  verifyAfter(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ) {
    expect(this.captureAfter).toHaveLength(1);
    expect(this.captureAfter[0].hookContext).toEqual(hookContext);
    expect(this.captureAfter[0].hookData).toEqual(data);
    expect(this.captureAfter[0].detail).toEqual(detail);
  }

  beforeEvalImpl: (
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ) => integrations.EvaluationSeriesData = (_hookContext, data) => data;

  afterEvalImpl: (
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ) => integrations.EvaluationSeriesData = (_hookContext, data, _detail) => data;

  beforeEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
  ): integrations.EvaluationSeriesData {
    this.captureBefore.push({ method: 'beforeEvaluation', hookContext, hookData: data });
    return this.beforeEvalImpl(hookContext, data);
  }
  afterEvaluation?(
    hookContext: integrations.EvaluationSeriesContext,
    data: integrations.EvaluationSeriesData,
    detail: LDEvaluationDetail,
  ): integrations.EvaluationSeriesData {
    this.captureAfter.push({ method: 'afterEvaluation', hookContext, hookData: data, detail });
    return this.afterEvalImpl(hookContext, data, detail);
  }
}

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;
  let testHook: TestHook;
  let logger: TestLogger;

  beforeEach(async () => {
    logger = new TestLogger();
    testHook = new TestHook();
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
        hooks: [testHook],
        logger,
      },
      makeCallbacks(true),
    );

    await client.waitForInitialization();
  });

  afterEach(() => {
    client.close();
  });

  it('variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.variation('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.variationDetail('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variationDetail',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('boolean variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.boolVariation('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariation',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('boolean variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').booleanFlag().on(true));
    await client.boolVariationDetail('flagKey', defaultUser, false);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.boolVariationDetail',
      },
      {},
      {
        value: true,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('number variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll(42).on(true));
    await client.numberVariation('flagKey', defaultUser, 21);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariation',
      },
      {},
      {
        value: 42,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('number variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll(42).on(true));
    await client.numberVariationDetail('flagKey', defaultUser, 21);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 21,
        method: 'LDClient.numberVariationDetail',
      },
      {},
      {
        value: 42,
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('string variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('strValue').on(true));
    await client.stringVariation('flagKey', defaultUser, 'default');
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariation',
      },
      {},
      {
        value: 'strValue',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('string variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('strValue').on(true));
    await client.stringVariationDetail('flagKey', defaultUser, 'default');
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'default',
        method: 'LDClient.stringVariationDetail',
      },
      {},
      {
        value: 'strValue',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('json variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll({ the: 'value' }).on(true));
    await client.jsonVariation('flagKey', defaultUser, { default: 'value' });
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariation',
      },
      {},
      {
        value: { the: 'value' },
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('json variation detail triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll({ the: 'value' }).on(true));
    await client.jsonVariationDetail('flagKey', defaultUser, { default: 'value' });
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariationDetail',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: { default: 'value' },
        method: 'LDClient.jsonVariationDetail',
      },
      {},
      {
        value: { the: 'value' },
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('migration variation triggers before/after evaluation hooks', async () => {
    td.update(td.flag('flagKey').valueForAll('live'));
    await client.migrationVariation('flagKey', defaultUser, LDMigrationStage.Off);
    testHook.verifyBefore(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'off',
        method: 'LDClient.migrationVariation',
      },
      {},
    );
    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: 'off',
        method: 'LDClient.migrationVariation',
      },
      {},
      {
        value: 'live',
        reason: Reasons.Fallthrough,
        variationIndex: 0,
      },
    );
  });

  it('propagates data between stages', async () => {
    testHook.beforeEvalImpl = (
      _hookContext: integrations.EvaluationSeriesContext,
      data: integrations.EvaluationSeriesData,
    ) => ({
      ...data,
      added: 'added data',
    });
    await client.variation('flagKey', defaultUser, false);

    testHook.verifyAfter(
      {
        flagKey: 'flagKey',
        context: { ...defaultUser },
        defaultValue: false,
        method: 'LDClient.variation',
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
    await client.variation('flagKey', defaultUser, false);
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
    await client.variation('flagKey', defaultUser, false);
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
    await client.variation('flagKey', defaultUser, false);

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
    await client.variation('flagKey', defaultUser, false);
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
  const td = new TestData();
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    {
      updateProcessor: td.getFactory(),
      sendEvents: false,
      logger,
    },
    makeCallbacks(true),
  );

  await client.waitForInitialization();

  td.update(td.flag('flagKey').booleanFlag().on(true));
  const testHook = new TestHook();
  client.addHook(testHook);

  await client.variation('flagKey', defaultUser, false);
  testHook.verifyBefore(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
    },
    {},
  );
  testHook.verifyAfter(
    {
      flagKey: 'flagKey',
      context: { ...defaultUser },
      defaultValue: false,
      method: 'LDClient.variation',
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
  const td = new TestData();
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    {
      updateProcessor: td.getFactory(),
      sendEvents: false,
      logger,
      hooks: [hookA, hookB],
    },
    makeCallbacks(true),
  );

  await client.waitForInitialization();
  client.addHook(hookC);
  await client.variation('flagKey', defaultUser, false);

  expect(beforeCalledOrder).toEqual(['a', 'b', 'c']);
  expect(afterCalledOrder).toEqual(['c', 'b', 'a']);
});
