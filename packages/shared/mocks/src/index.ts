import { clientContext } from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { hasher } from './crypto';
import { MockEventProcessor, setupMockEventProcessor } from './eventProcessor';
import logger from './logger';
import { basicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  basicPlatform,
  clientContext,
  hasher,
  logger,
  ContextDeduplicator,
  MockEventProcessor,
  setupMockEventProcessor,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
};
