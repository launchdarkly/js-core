import type {
  ClientContext,
  EventName,
  internal,
  LDStreamingError,
  ProcessStreamResponse,
} from 'shared-common-types';

export const MockStreamingProcessor = jest.fn();

export const setupMockStreamingProcessor = (shouldError: boolean = false) => {
  MockStreamingProcessor.mockImplementation(
    (
      sdkKey: string,
      clientContext: ClientContext,
      listeners: Map<EventName, ProcessStreamResponse>,
      diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: internal.StreamingErrorHandler,
      __streamInitialReconnectDelay: number,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          process.nextTick(() =>
            errorHandler({
              code: 401,
              name: 'LaunchDarklyStreamingError',
              message: 'test-error',
            } as LDStreamingError),
          );
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
