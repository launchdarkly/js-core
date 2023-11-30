import type {
  ClientContext,
  EventName,
  internal,
  LDStreamingError,
  ProcessStreamResponse,
} from '@common';

export const MockStreamingProcessor = jest.fn();

export const setupMockStreamingProcessor = (
  shouldError: boolean = false,
  putResponseJson: any = { data: { flags: {}, segments: {} } },
) => {
  MockStreamingProcessor.mockImplementation(
    (
      sdkKey: string,
      clientContext: ClientContext,
      streamUriPath: string,
      listeners: Map<EventName, ProcessStreamResponse>,
      diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: internal.StreamingErrorHandler,
      _streamInitialReconnectDelay: number,
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
          process.nextTick(() => listeners.get('put')?.processJson(putResponseJson));
        }
      }),
      close: jest.fn(),
      eventSource: {},
    }),
  );
};
