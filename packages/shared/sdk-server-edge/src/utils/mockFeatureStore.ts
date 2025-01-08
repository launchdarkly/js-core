import type { LDFeatureStore } from '@launchdarkly/js-server-sdk-common';

const mockFeatureStore: LDFeatureStore = {
  all: jest.fn(),
  close: jest.fn(),
  init: jest.fn(),
  initialized: jest.fn(),
  upsert: jest.fn(),
  applyChanges: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
};

export default mockFeatureStore;
