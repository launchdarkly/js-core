import { clientContext, clientContextDom } from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { crypto, hasher } from './hasher';
import logger from './logger';
import { basicPlatform, basicPlatformDom } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

export {
  basicPlatform,
  basicPlatformDom,
  clientContext,
  clientContextDom,
  crypto,
  logger,
  hasher,
  ContextDeduplicator,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
};
