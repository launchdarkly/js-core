import { clientContext } from './clientContext';
import ContextDeduplicator from './contextDeduplicator';
import { hasher } from './crypto';
import logger from './logger';
import mockFetch from './mockFetch';
import { basicPlatform } from './platform';
import { MockStreamingProcessor, setupMockStreamingProcessor } from './streamingProcessor';

/**
 * Internal use only.
 * This project contains JavaScript mocks that are consumed in unit tests in client-side and server-side JavaScript SDKs.
 * @internal
 */
export {
  basicPlatform,
  clientContext,
  hasher,
  mockFetch,
  logger,
  ContextDeduplicator,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
};
