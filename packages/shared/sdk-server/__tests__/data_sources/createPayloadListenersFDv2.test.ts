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
  id: 'payloadID',
  version: 99,
  state: 'initial',
  basis: true,
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
};

const changesTransferPayload = {
  id: 'payloadID',
  version: 99,
  state: 'changes',
  basis: false,
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
};

describe('createPayloadListenerFDv2', () => {
  let dataSourceUpdates: LDTransactionalDataSourceUpdates;
  let basisRecieved: jest.Mock;

  beforeEach(() => {
    dataSourceUpdates = {
      init: jest.fn(),
      upsert: jest.fn(),
      applyChanges: jest.fn(),
    };
    basisRecieved = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('data source init is called', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, basisRecieved);
    listener(fullTransferPayload);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/initializing/i));
    expect(dataSourceUpdates.init).toBeCalledWith(
      {
        features: {
          flagkey: { key: 'flagkey', version: 1 },
        },
        segments: {
          segkey: { key: 'segkey', version: 2 },
        },
      },
      basisRecieved,
    );
  });

  test('data source upsert is called', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, basisRecieved);
    listener(changesTransferPayload);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/updating/i));
    expect(dataSourceUpdates.upsert).toHaveBeenCalledTimes(3);
    expect(dataSourceUpdates.upsert).toHaveBeenNthCalledWith(
      1,
      { namespace: 'features' },
      { key: 'flagkey', version: 1 },
      expect.anything(),
    );
    expect(dataSourceUpdates.upsert).toHaveBeenNthCalledWith(
      2,
      { namespace: 'segments' },
      { key: 'segkey', version: 2 },
      expect.anything(),
    );
    expect(dataSourceUpdates.upsert).toHaveBeenNthCalledWith(
      3,
      { namespace: 'features' },
      { key: 'deletedFlag', version: 3, deleted: true },
      expect.anything(),
    );
  });
});
