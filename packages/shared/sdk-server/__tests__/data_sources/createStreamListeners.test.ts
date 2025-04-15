import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../../src/api/subsystems';
import { createStreamListeners } from '../../src/data_sources/createStreamListeners';
import { deserializeAll, deserializeDelete, deserializePatch } from '../../src/store/serialization';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

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

const allData = {
  data: {
    flags: {
      flagkey: { key: 'flagkey', version: 1 },
    },
    segments: {
      segkey: { key: 'segkey', version: 2 },
    },
  },
};

const patchData = {
  path: '/flags/flagkey',
  data: { key: 'flagkey', version: 1 },
  kind: VersionedDataKinds.Features,
};

const deleteData = { path: '/flags/flagkey', version: 2, kind: VersionedDataKinds.Features };

describe('createStreamListeners', () => {
  let dataSourceUpdates: LDDataSourceUpdates;
  let onPutCompleteHandler: jest.Mock;
  let onPatchCompleteHandler: jest.Mock;
  let onDeleteCompleteHandler: jest.Mock;
  let onCompleteHandlers: {
    put: jest.Mock;
    patch: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    dataSourceUpdates = {
      init: jest.fn(),
      upsert: jest.fn(),
    };
    onPutCompleteHandler = jest.fn();
    onPatchCompleteHandler = jest.fn();
    onDeleteCompleteHandler = jest.fn();
    onCompleteHandlers = {
      put: onPutCompleteHandler,
      patch: onPatchCompleteHandler,
      delete: onDeleteCompleteHandler,
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('put', () => {
    test('creates put patch delete handlers', () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);

      expect(listeners.size).toEqual(3);
      expect(listeners.has('put')).toBeTruthy();
      expect(listeners.has('patch')).toBeTruthy();
      expect(listeners.has('delete')).toBeTruthy();
    });

    test('createPutListener', () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { deserializeData, processJson } = listeners.get('put')!;

      expect(deserializeData).toBe(deserializeAll);
      expect(processJson).toBeDefined();
    });

    test('data source init is called', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('put')!;
      const {
        data: { flags, segments },
      } = allData;

      processJson(allData);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/initializing/i));
      expect(dataSourceUpdates.init).toHaveBeenCalledWith(
        {
          features: flags,
          segments,
        },
        onPutCompleteHandler,
        undefined,
      );
    });

    test('data source init is called with initialization metadata', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('put')!;
      const {
        data: { flags, segments },
      } = allData;
      const initHeaders = {
        'x-ld-envid': '12345',
      };
      processJson(allData, initHeaders);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/initializing/i));
      expect(dataSourceUpdates.init).toHaveBeenCalledWith(
        {
          features: flags,
          segments,
        },
        onPutCompleteHandler,
        { environmentId: '12345' },
      );
    });
  });

  describe('patch', () => {
    test('createPatchListener', () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { deserializeData, processJson } = listeners.get('patch')!;

      expect(deserializeData).toBe(deserializePatch);
      expect(processJson).toBeDefined();
    });

    test('data source upsert is called', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('patch')!;
      const { data, kind } = patchData;

      processJson(patchData);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/updating/i));
      expect(dataSourceUpdates.upsert).toHaveBeenCalledWith(kind, data, onPatchCompleteHandler);
    });

    test('data source upsert not called missing kind', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('patch')!;
      const missingKind = { ...patchData, kind: undefined };

      processJson(missingKind);

      expect(dataSourceUpdates.upsert).not.toHaveBeenCalled();
    });

    test('data source upsert not called wrong namespace path', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('patch')!;
      const wrongKey = { ...patchData, path: '/wrong/flagkey' };

      processJson(wrongKey);

      expect(dataSourceUpdates.upsert).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    test('createDeleteListener', () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { deserializeData, processJson } = listeners.get('delete')!;

      expect(deserializeData).toBe(deserializeDelete);
      expect(processJson).toBeDefined();
    });

    test('data source upsert is called', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('delete')!;
      const { kind, version } = deleteData;

      processJson(deleteData);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/deleting/i));
      expect(dataSourceUpdates.upsert).toHaveBeenCalledWith(
        kind,
        { key: 'flagkey', version, deleted: true },
        onDeleteCompleteHandler,
      );
    });

    test('data source upsert not called missing kind', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('delete')!;
      const missingKind = { ...deleteData, kind: undefined };

      processJson(missingKind);

      expect(dataSourceUpdates.upsert).not.toHaveBeenCalled();
    });

    test('data source upsert not called wrong namespace path', async () => {
      const listeners = createStreamListeners(dataSourceUpdates, logger, onCompleteHandlers);
      const { processJson } = listeners.get('delete')!;
      const wrongKey = { ...deleteData, path: '/wrong/flagkey' };

      processJson(wrongKey);

      expect(dataSourceUpdates.upsert).not.toHaveBeenCalled();
    });
  });
});
