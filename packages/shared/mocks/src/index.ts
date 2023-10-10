import clientContext from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { crypto, hasher } from './hasher';
import logger from './logger';
import mockFetch from './mockFetch';
import basicPlatform from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  basicPlatform,
  clientContext,
  mockFetch,
  crypto,
  logger,
  hasher,
  ContextDeduplicator,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
};
