import clientContext from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { hasher } from './crypto';
import logger from './logger';
import mockFetch from './mockFetch';
import { basicPlatform } from './platform';
import setupMocks from './setupMocks';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  basicPlatform,
  clientContext,
  hasher,
  mockFetch,
  logger,
  ContextDeduplicator,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
  setupMocks,
};
