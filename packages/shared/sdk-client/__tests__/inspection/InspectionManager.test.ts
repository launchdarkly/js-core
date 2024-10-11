import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { LDLogger } from '@launchdarkly/js-sdk-common';

import InspectorManager from '../../src/inspection/InspectorManager';

describe('given an inspector manager with no registered inspectors', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const manager = new InspectorManager([], logger);

  it('does not cause errors and does not produce any logs', () => {
    manager.onIdentityChanged({ kind: 'user', key: 'key' });
    manager.onFlagUsed(
      'flag-key',
      {
        value: null,
        reason: null,
      },
      { key: 'key' },
    );
    manager.onFlagsChanged({});
    manager.onFlagChanged('flag-key', {
      value: null,
      reason: null,
    });

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports that it has no inspectors', () => {
    expect(manager.hasInspectors()).toBeFalsy();
  });
});

describe('given an inspector with callbacks of every type', () => {
  /**
   * @type {AsyncQueue}
   */
  const eventQueue = new AsyncQueue();
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const manager = new InspectorManager(
    [
      {
        type: 'flag-used',
        name: 'my-flag-used-inspector',
        method: (flagKey, flagDetail, context) => {
          eventQueue.add({ type: 'flag-used', flagKey, flagDetail, context });
        },
      },
      // 'flag-used registered twice.
      {
        type: 'flag-used',
        name: 'my-other-flag-used-inspector',
        method: (flagKey, flagDetail, context) => {
          eventQueue.add({ type: 'flag-used', flagKey, flagDetail, context });
        },
      },
      {
        type: 'flag-details-changed',
        name: 'my-flag-details-inspector',
        method: (details) => {
          eventQueue.add({
            type: 'flag-details-changed',
            details,
          });
        },
      },
      {
        type: 'flag-detail-changed',
        name: 'my-flag-detail-inspector',
        method: (flagKey, flagDetail) => {
          eventQueue.add({
            type: 'flag-detail-changed',
            flagKey,
            flagDetail,
          });
        },
      },
      {
        type: 'client-identity-changed',
        name: 'my-identity-inspector',
        method: (context) => {
          eventQueue.add({
            type: 'client-identity-changed',
            context,
          });
        },
      },
      // Invalid inspector shouldn't have an effect.
      {
        // @ts-ignore
        type: 'potato',
        name: 'my-potato-inspector',
        method: () => {},
      },
    ],
    logger,
  );

  afterEach(() => {
    expect(eventQueue.length()).toEqual(0);
  });

  afterAll(() => {
    eventQueue.close();
  });

  it('logged that there was a bad inspector', () => {
    expect(logger.warn).toHaveBeenCalledWith(
      'an inspector: "my-potato-inspector" of an invalid type (potato) was configured',
    );
  });

  it('executes `onFlagUsed` handlers', async () => {
    manager.onFlagUsed(
      'flag-key',
      {
        value: 'test',
        variationIndex: 1,
        reason: {
          kind: 'OFF',
        },
      },
      { key: 'test-key' },
    );

    const expectedEvent = {
      type: 'flag-used',
      flagKey: 'flag-key',
      flagDetail: {
        value: 'test',
        variationIndex: 1,
        reason: {
          kind: 'OFF',
        },
      },
      context: { key: 'test-key' },
    };
    const event1 = await eventQueue.take();
    expect(event1).toMatchObject(expectedEvent);

    // There are two handlers, so there should be another event.
    const event2 = await eventQueue.take();
    expect(event2).toMatchObject(expectedEvent);
  });

  it('executes `onFlags` handler', async () => {
    manager.onFlagsChanged({
      example: { value: 'a-value', reason: null },
    });

    const event = await eventQueue.take();
    expect(event).toMatchObject({
      type: 'flag-details-changed',
      details: {
        example: { value: 'a-value' },
      },
    });
  });

  it('executes `onFlagChanged` handler', async () => {
    manager.onFlagChanged('the-flag', { value: 'a-value', reason: null });

    const event = await eventQueue.take();
    expect(event).toMatchObject({
      type: 'flag-detail-changed',
      flagKey: 'the-flag',
      flagDetail: {
        value: 'a-value',
      },
    });
  });

  it('executes `onIdentityChanged` handler', async () => {
    manager.onIdentityChanged({ key: 'the-key' });

    const event = await eventQueue.take();
    expect(event).toMatchObject({
      type: 'client-identity-changed',
      context: { key: 'the-key' },
    });
  });

  it('reports that it has inspectors', () => {
    expect(manager.hasInspectors()).toBeTruthy();
  });
});
