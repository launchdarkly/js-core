import ContextDeduplicator from './contextDeduplicator';
import { MockEventProcessor, setupMockEventProcessor } from './eventProcessor';
import logger, { createLogger } from './logger';
import { createBasicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  logger,
  createLogger,
  ContextDeduplicator,
  MockEventProcessor,
  setupMockEventProcessor,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
  createBasicPlatform,
};
