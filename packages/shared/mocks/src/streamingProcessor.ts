import type {
  EventName,
  internal,
  LDLogger,
  LDStreamingError,
  ProcessStreamResponse,
} from '@common';
import { EventSource } from '@common';

export const MockStreamingProcessor = jest.fn();

export const setupMockStreamingProcessor = (shouldError: boolean = false) => {
  MockStreamingProcessor.mockImplementation(
    (
      _createEventSource: () => EventSource,
      listeners: Map<EventName, ProcessStreamResponse>,
      _diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: internal.StreamingErrorHandler,
      _logger: LDLogger,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          process.nextTick(() => {
            const unauthorized: LDStreamingError = {
              code: 401,
              name: 'LaunchDarklyStreamingError',
              message: 'test-error',
            };
            errorHandler(unauthorized);
          });
        } else {
          // execute put which will resolve the init promise
          process.nextTick(
            () => listeners.get('put')?.processJson({ data: { flags: {}, segments: {} } }),
          );
        }
      }),
      close: jest.fn(),
    }),
  );
};
