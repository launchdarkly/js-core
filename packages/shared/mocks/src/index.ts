import ContextDeduplicator from './contextDeduplicator';
import { MockEventProcessor, setupMockEventProcessor } from './eventProcessor';
import { createLogger } from './logger';
import { createBasicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  createLogger,
  ContextDeduplicator,
  MockEventProcessor,
  setupMockEventProcessor,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
  createBasicPlatform,
};
