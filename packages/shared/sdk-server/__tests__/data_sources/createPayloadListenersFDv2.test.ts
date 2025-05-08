import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../../src/api/subsystems';
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

const changesTransferNone = {
  id: 'payloadID',
  version: 99,
  basis: false,
  updates: [],
};

describe('createPayloadListenerFDv2', () => {
  let dataSourceUpdates: LDDataSourceUpdates;
  let basisReceived: jest.Mock;

  beforeEach(() => {
    dataSourceUpdates = {
      init: jest.fn(),
      upsert: jest.fn(),
      applyChanges: jest.fn(),
    };
    basisReceived = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('data source updates called with basis true', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, basisReceived);
    listener(fullTransferPayload);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/initializing/i));
    expect(dataSourceUpdates.applyChanges).toBeCalledWith(
      true,
      {
        features: {
          flagkey: { key: 'flagkey', version: 1 },
        },
        segments: {
          segkey: { key: 'segkey', version: 2 },
        },
      },
      basisReceived,
      'initial',
    );
  });

  test('data source updates called with basis false', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, basisReceived);
    listener(changesTransferPayload);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/updating/i));
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
      basisReceived,
      'changes',
    );
  });

  test('data source updates not called when basis is false and changes are empty', async () => {
    const listener = createPayloadListener(dataSourceUpdates, logger, basisReceived);
    listener(changesTransferNone);

    expect(logger.debug).toBeCalledWith(expect.stringMatching(/ignoring/i));
    expect(dataSourceUpdates.applyChanges).toHaveBeenCalledTimes(0);
  });
});
