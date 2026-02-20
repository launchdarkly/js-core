import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDTransactionalDataSourceUpdates } from '../../src/api/subsystems';
import { createPayloadListener } from '../../src/data_sources/createPayloadListenerFDv2';

jest.mock('../../src/store/serialization');

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

const fullTransferPayload = {
  initMetadata: {
    environmentId: 'envId',
  },
  payload: {
    id: 'payloadID',
    version: 99,
    state: 'initial',
    type: 'full' as const,
    updates: [
      {
        kind: 'flag',
        key: 'flagkey',
        version: 1,
        object: {
          key: 'flagkey',
          version: 1,
        },
      },
      {
        kind: 'segment',
        key: 'segkey',
        version: 1,
        object: {
          key: 'segkey',
          version: 2,
        },
      },
    ],
  },
};

const changesTransferPayload = {
  initMetadata: {
    environmentId: 'envId',
  },
  payload: {
    id: 'payloadID',
    version: 99,
    state: 'changes',
    type: 'partial' as const,
    updates: [
      {
        kind: 'flag',
        key: 'flagkey',
        version: 1,
        object: {
          key: 'flagkey',
          version: 1,
        },
      },
      {
        kind: 'segment',
        key: 'segkey',
        version: 2,
        object: {
          key: 'segkey',
          version: 2,
        },
      },
      {
        kind: 'flag',
        key: 'deletedFlag',
        version: 3,
        object: {
          key: 'deletedFlag',
          version: 3,
        },
        deleted: true,
      },
    ],
  },
};

const changesTransferNone = {
  initMetadata: {
    environmentId: 'envId',
  },
  payload: {
    id: 'payloadID',
    version: 99,
    type: 'none' as const,
    updates: [],
  },
};

describe('createPayloadListenerFDv2', () => {
  let dataSourceUpdates: LDTransactionalDataSourceUpdates;
  let initializedCallback: jest.Mock;

  beforeEach(() => {
    dataSourceUpdates = {
      init: jest.fn(),
      upsert: jest.fn(),
      applyChanges: jest.fn(),
    };
    initializedCallback = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('data source updates called with basis true', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, initializedCallback);
    listener(fullTransferPayload);

    expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/initializing/i));
    expect(dataSourceUpdates.applyChanges).toHaveBeenCalledWith(
      true,
      {
        features: {
          flagkey: { key: 'flagkey', version: 1 },
        },
        segments: {
          segkey: { key: 'segkey', version: 2 },
        },
      },
      expect.any(Function),
      { environmentId: 'envId' },
      'initial',
    );
  });

  test('data source updates called with basis false', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, initializedCallback);
    listener(changesTransferPayload);

    expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/updating/i));
    expect(dataSourceUpdates.applyChanges).toHaveBeenCalledTimes(1);
    expect(dataSourceUpdates.applyChanges).toHaveBeenNthCalledWith(
      1,
      false,
      {
        features: {
          deletedFlag: {
            key: 'deletedFlag',
            deleted: true,
            version: 3,
          },
          flagkey: {
            key: 'flagkey',
            version: 1,
          },
        },
        segments: {
          segkey: {
            key: 'segkey',
            version: 2,
          },
        },
      },
      expect.any(Function),
      { environmentId: 'envId' },
      'changes',
    );
  });

  test('data source updates not called when basis is false and changes are empty', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, initializedCallback);
    listener(changesTransferNone);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/ignoring/i));
    expect(dataSourceUpdates.applyChanges).toHaveBeenCalledTimes(0);
  });

  test('calls initializedCallback when state is non-empty (initial)', () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, initializedCallback);
    let capturedCallback: (() => void) | undefined;

    dataSourceUpdates.applyChanges = jest.fn((_basis, _data, callback) => {
      capturedCallback = callback;
    });

    listener(fullTransferPayload);

    expect(capturedCallback).toBeDefined();
    expect(initializedCallback).not.toHaveBeenCalled();

    // Simulate applyChanges calling the callback
    capturedCallback?.();

    expect(initializedCallback).toHaveBeenCalledTimes(1);
  });

  test('does not call initializedCallback when state is empty (file data initializer)', () => {
    const fileDataPayload = {
      initMetadata: {
        environmentId: 'envId',
      },
      payload: {
        id: 'payloadID',
        version: 99,
        state: '',
        type: 'full' as const,
        updates: [
          {
            kind: 'flag',
            key: 'flagkey',
            version: 1,
            object: {
              key: 'flagkey',
              version: 1,
            },
          },
        ],
      },
    };

    const listener = createPayloadListener(dataSourceUpdates, logger, initializedCallback);
    let capturedCallback: (() => void) | undefined;

    dataSourceUpdates.applyChanges = jest.fn((_basis, _data, callback) => {
      capturedCallback = callback;
    });

    listener(fileDataPayload);

    expect(capturedCallback).toBeDefined();
    expect(initializedCallback).not.toHaveBeenCalled();

    // Simulate applyChanges calling the callback
    capturedCallback?.();

    // Should still not be called because state is empty
    expect(initializedCallback).not.toHaveBeenCalled();
  });
});
