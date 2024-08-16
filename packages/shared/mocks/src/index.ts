import ContextDeduplicator from './contextDeduplicator';
import { MockEventProcessor, setupMockEventProcessor } from './eventProcessor';
import logger from './logger';
import { createBasicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  logger,
  ContextDeduplicator,
  MockEventProcessor,
  setupMockEventProcessor,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
  createBasicPlatform,
};
