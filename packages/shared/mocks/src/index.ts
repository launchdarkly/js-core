import { clientContext } from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { hasher } from './crypto';
import { MockEventProcessor, setupMockEventProcessor } from './eventProcessor';
import logger from './logger';
import mockFetch from './mockFetch';
import { basicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  basicPlatform,
  clientContext,
  hasher,
  mockFetch,
  logger,
  ContextDeduplicator,
  MockEventProcessor,
  setupMockEventProcessor,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
};
